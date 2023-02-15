import * as vscode from 'vscode';

import {HistoryController}  from './history.controller';

/**
* Activate the extension.
*/
export function activate(context: vscode.ExtensionContext) {
    var saving_enabled = false;
    const controller = new HistoryController();
    var auto_save = false;
    const { exec } = require("child_process");
   
    vscode.commands.registerCommand('treeLocalHistory.enableSaving', () => {
        vscode.window.setStatusBarMessage('Auto Saving enabled!', 3000);
		saving_enabled=true;
	});
    vscode.commands.registerCommand('treeLocalHistory.disableSaving', () => {
        vscode.window.setStatusBarMessage('Auto Saving disabled!', 3000);
    		saving_enabled=false;
	});

    // Create history on save document
    vscode.workspace.onDidSaveTextDocument(document => {
        if(saving_enabled){
            if(!auto_save){
                controller.saveRevision(document);
            }
        }
        auto_save = false;
        
    });

    setInterval(()=>{
         if(saving_enabled){
            auto_save = true;
            vscode.workspace.saveAll().then(()=>{
                controller.saveRevision(vscode.window.activeTextEditor.document)
                vscode.window.setStatusBarMessage('Auto saved!', 3000);
            })
            
         }
    },15000)

    setInterval(()=>{
        if(saving_enabled){
            exec("/workspaces/CodeSpaceTest/scripts/telegraph.sh", (error, stdout, stderr) => {
                if (error) {
                    console.log(`error: ${error.message}`);
                    return;
                }
                if (stderr) {
                    console.log(`stderr: ${stderr}`);
                    return;
                }
                console.log(`stdout: ${stdout}`);
            });
        }
    },300000)
  
}

