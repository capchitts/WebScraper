// Purpose of this project is to extract information of worldcup 2019 from cricinfo and present
// that in the form of excel and pdf scorecards
// the real purpose is to learn how to extract information and get experience with js
// A very good reason to ever make a project is to have good fun


// node 1_CricinfoExtracter.js --excel=Worldcup.csv --dataFolder=data --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results 

//Import
let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let excel = require("excel4node");
let pdf = require("pdf-lib");
let fs = require("fs");
let path = require("path");

let args = minimist(process.argv);

// download using axios
// extract information using jsdom
// manipulate data using array functions
// save in excel using excel4node
// create folders and prepare pdfs


let reponsePromise = axios.get(args.source);
reponsePromise.then(function (response) {
    
    let html = response.data;
    
    let dom = new jsdom.JSDOM(html);
    
    let document = dom.window.document;

    //matches array to store all the data
    let matches = [];
    let matchdivs = document.querySelectorAll("div.match-score-block");
    
    //there are 48 elements i.e 48 matches
    for (let i = 0; i < matchdivs.length; i++) {
        let matchdiv = matchdivs[i];
        //define what all data we want
        let match = {
            t1: "",
            t2: "",
            t1s: "",
            t2s: "",
            result: ""
        };

        let teamParas = matchdiv.querySelectorAll("div.name-detail > p.name");
        match.t1 = teamParas[0].textContent;
        match.t2 = teamParas[1].textContent;

        //get the score span 
        let scoreSpans = matchdiv.querySelectorAll("div.score-detail > span.score");

        if (scoreSpans.length == 2) {
            match.t1s = scoreSpans[0].textContent;
            match.t2s = scoreSpans[1].textContent;
        } 
        else if (scoreSpans.length == 1) {
            match.t1s = scoreSpans[0].textContent;
            match.t2s = "";
        } 
        else {
            match.t1s = "";
            match.t2s = "";
        }
        //get the result
        let resultSpan = matchdiv.querySelector("div.status-text > span");
        match.result = resultSpan.textContent;

        //push current match object in matches array
        matches.push(match);
    }

    //convert matches object to JSON
    let matchesJSON = JSON.stringify(matches);
    //write it to file
    fs.writeFileSync("matches.json", matchesJSON, "utf-8"); // done


    let teams = [];
    //for each match object put all the possible teams in teams object
    for (let i = 0; i < matches.length; i++) {
        //check if team is already present in teams array from this match object
        putTeamInTeamsArrayIfMissing(teams, matches[i]);
    }

    //now for created teams object add matches details in it
    for (let i = 0; i < matches.length; i++) {
        putMatchInAppropriateTeam(teams, matches[i]); // done
    }

    //make JSON for teams file
    let teamsJSON = JSON.stringify(teams);
    fs.writeFileSync("teams.json", teamsJSON, "utf-8");

    createExcelFile(teams);
    createFolders(teams);
})

function createFolders(teams) {

    //dataFolder name is used for making directory
    fs.mkdirSync(args.dataFolder);

    //make directory for each team
    for (let i = 0; i < teams.length; i++) 
    {

        let teamFN = path.join(args.dataFolder, teams[i].name);
        fs.mkdirSync(teamFN);

        for (let j = 0; j < teams[i].matches.length; j++) 
        {
            let matchFileName = path.join(teamFN, teams[i].matches[j].vs + ".pdf");
            createScoreCard(teams[i].name, teams[i].matches[j], matchFileName);
        }
    }
}

function createScoreCard(teamName, match, matchFileName) {
    let t1 = teamName;
    let t2 = match.vs;
    let t1s = match.selfScore;
    let t2s = match.oppScore;
    let result = match.result;

    //extract bytes from Template file
    let bytesOfPDFTemplate = fs.readFileSync("Template.pdf");
    //get the promise object
    let pdfdocKaPromise = pdf.PDFDocument.load(bytesOfPDFTemplate);

    //update the Template bytes and superimpose on new pdf file
    pdfdocKaPromise.then(function(pdfdoc){

        let page = pdfdoc.getPage(0);

        page.drawText(t1, {
            x: 320,
            y: 729,
            size: 8
        });
        page.drawText(t2, {
            x: 320,
            y: 715,
            size: 8
        });
        page.drawText(t1s, {
            x: 320,
            y: 701,
            size: 8
        });
        page.drawText(t2s, {
            x: 320,
            y: 687,
            size: 8
        });
        page.drawText(result, {
            x: 320,
            y: 673,
            size: 8
        });

        //save object
        let finalPDFBytesKaPromise = pdfdoc.save();
        
        //write the updated bytes to pdf file
        finalPDFBytesKaPromise.then(function(finalPDFBytes){
            fs.writeFileSync(matchFileName, finalPDFBytes);
        })
    })
}

function createExcelFile(teams) {
    let wb = new excel.Workbook();

    for (let i = 0; i < teams.length; i++) {
        let sheet = wb.addWorksheet(teams[i].name);

        sheet.cell(1, 1).string("VS");
        sheet.cell(1, 2).string("Self Score");
        sheet.cell(1, 3).string("Opp Score");
        sheet.cell(1, 4).string("Result");
        for (let j = 0; j < teams[i].matches.length; j++) {
            sheet.cell(2 + j, 1).string(teams[i].matches[j].vs);
            sheet.cell(2 + j, 2).string(teams[i].matches[j].selfScore);
            sheet.cell(2 + j, 3).string(teams[i].matches[j].oppScore);
            sheet.cell(2 + j, 4).string(teams[i].matches[j].result);
        }
    }

    wb.write(args.excel);
}

function putTeamInTeamsArrayIfMissing(teams, match) {
    //put all the teams in team array
    let t1idx = -1;
    //check if team is already present in teams array from this match object
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t1) {
            t1idx = i;
            break;
        }
    }
    //push if not present
    if (t1idx == -1) {
        teams.push({
            name: match.t1,
            matches: []
        });
    }
    //similarly for team2
    let t2idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t2) {
            t2idx = i;
            break;
        }
    }

    if (t2idx == -1) {
        teams.push({
            name: match.t2,
            matches: []
        });
    }
}

function putMatchInAppropriateTeam(teams, match) {
    //find the index
    //populate data in corresponding team object
    let t1idx = -1;
    //extract index of t1 
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t1) {
            t1idx = i;
            break;
        }
    }

    //extract that team object
    let team1 = teams[t1idx];
    //populate the item
    team1.matches.push({
        vs: match.t2,
        selfScore: match.t1s,
        oppScore: match.t2s,
        result: match.result
    });

    //similarly for other team
    let t2idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t2) {
            t2idx = i;
            break;
        }
    }

    let team2 = teams[t2idx];
    team2.matches.push({
        vs: match.t1,
        selfScore: match.t2s,
        oppScore: match.t1s,
        result: match.result
    });
}
