'use strict';
import * as vscode from 'vscode';
import fetch from 'node-fetch';

/*
 * http://esprima.readthedocs.io/en/4.0/getting-started.html#using-node-js-to-play-with-esprima
 * Refer to the above documentation for AST object structure
 */
import { parseScript } from 'esprima';

// this method is called when the extension is activated
// extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    console.log('intellisense-node is activated');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    const disposable = vscode.commands.registerCommand('extension.searchAPI', () => {
        vscode.window.showInputBox({
            prompt: 'Please describe the task you want to accomplish, and optionally provide involved variables',
            value: 'I want a method to help me ${}, which probably takes ${} as input and returns ${}'
        }).then(desc => {
            const editor = vscode.window.activeTextEditor;       
            if (editor !== undefined && desc !== undefined) {
                const position = editor.selection.active;
                const text = editor.document.getText();
                fetch("http://localhost:8080/api/search", { 
                    method: 'POST',
                    body: `{'desc': ${desc}, 'ast': ${JSON.stringify(parseScript(text))}, 'currentLine': ${position.line}}` 
                })
                .then(res => res.json())
                .then(object => vscode.window.showInformationMessage(object.methodName))
                .catch(error => console.error('Error: ', error));
            } 
        });       
    });

    context.subscriptions.push(disposable);
}