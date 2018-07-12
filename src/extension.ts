'use strict';
import * as vscode from 'vscode';
import fetch from 'node-fetch';

/*
 * http://esprima.readthedocs.io/en/4.0/getting-started.html#using-node-js-to-play-with-esprima
 * Refer to the above documentation for AST object structure
 */
import { parseScript } from 'esprima';

let recPanel: vscode.WebviewPanel | undefined ;

let selectionPanel: vscode.WebviewPanel | undefined ;

let inputSelections: Array<string> = [];

let outputSelections: Array<string> = [];

// this method is called when the extension is activated
// extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // console.log('intellisense-node is activated');

    const searchRegistry = vscode.commands.registerCommand('extension.searchAPI', () => {
        vscode.window.showInputBox({
            prompt: 'Please describe the task you want to accomplish, and optionally provide involved variables',
            value: 'I want a method to help me ${}, which probably takes ${} as input and returns ${}'
        }).then(desc => {
            const editor = vscode.window.activeTextEditor;       
            if (editor !== undefined && desc !== undefined) {
                const position = editor.selection.active;
                const text = editor.document.getText();
                // console.log(JSON.stringify(parseScript(text, { loc: true, tolerant: true })));
                fetch("http://localhost:8088/api/search", { 
                    method: 'POST',
                    body: `{'desc': ${desc}, 'ast': ${JSON.stringify(parseScript(text, { loc: true, tolerant: true }))}, 'currentLine': ${position.line}， 'inputSelections': ${JSON.stringify(inputSelections)}, 'outputSelections': ${JSON.stringify(outputSelections)}}` 
                })
                .then(res => res.json())
                .then(object => updateRecView(object.html))
                .catch(error => console.error('Error: ', error));   
                // testRecView
                // updateRecView(`<!DOCTYPE html>
                // <html lang="en">
                // <head>
                //     <meta charset="UTF-8">
                //     <meta name="viewport" content="width=device-width, initial-scale=1.0">
                //     <title>Cat Coding</title>
                // </head>
                // <body>
                //     <img src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" width="300" />
                // </body>
                // </html>`);             
            } 
        });      
    });

    const updateRecView = (html: string) => {
        if (selectionPanel) {
            selectionPanel.dispose();
        }
        if (!recPanel) {
            recPanel = vscode.window.createWebviewPanel(
                'recommendationPanel',
                'Recommended APIs',
                vscode.ViewColumn.Three,
                {}
            );
            recPanel.onDidDispose(() => {
                recPanel = undefined;
            }, null, context.subscriptions);
        }               
        recPanel.webview.html = html;
    };

    const inputRegistry = vscode.commands.registerCommand('extension.selectInput', () => {
        const editor = vscode.window.activeTextEditor; 
        if (!editor) {
            vscode.window.showInformationMessage("No active editor detected. You can try to open a new editor.");
            return;
        }
        const selectedText = editor.document.getText(editor.selection);
        inputSelections.push(selectedText);
        updateSelectionView();
    });

    const outputRegistry = vscode.commands.registerCommand('extension.selectOutput', () => {
        const editor = vscode.window.activeTextEditor; 
        if (!editor) {
            vscode.window.showInformationMessage("No active editor detected. You can try to open a new editor.");
            return;
        }
        const selectedText = editor.document.getText(editor.selection);
        outputSelections.push(selectedText);
        updateSelectionView();
    });

    const deleteListItem = (id: string) => {
        if (id.startsWith('i')) {
            inputSelections.splice(parseInt(id.substring(1)));
        } else {
            outputSelections.splice(parseInt(id.substring(1)));
        }
        updateSelectionView();
    };

    const updateSelectionView = () => {
        if (!selectionPanel) {
            selectionPanel = vscode.window.createWebviewPanel(
                'selectionPanel',
                'Current selected fragments',
                vscode.ViewColumn.Three,
                {enableScripts: true}
            );
            selectionPanel.onDidDispose(() => {
                selectionPanel = undefined;
            }, null, context.subscriptions);
            selectionPanel.webview.onDidReceiveMessage(e => {
                switch (e.type) {
                  case 'delete':
                    deleteListItem(e.id);
                    break;
                }
              }, undefined, context.subscriptions);
        }
        const inputList = inputSelections.map((selection, i) => `<li id=i${i}>${selection} <a href="#" onclick="deleteListItem(this)">delete</a></li>
        `).join(''); 
        const outputList = outputSelections.map((selection, i) => `<li id=o${i}>${selection}  <a href="#" onclick="deleteListItem(this)">delete</a></li>`).join('');     
        const html = `<!DOCTYPE html>
                        <html lang="en">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>Current selected fragments</title>
                        </head>
                        <body>
                            <h3> Input: </h3>
                            <ul>
                                ${inputList}
                            </ul>
                            <h3> Output: </h3>
                            <ul>
                                ${outputList}
                            </ul>                           
                        </body>
                        <script>
                               const vscode = acquireVsCodeApi();
                               function deleteListItem(element) {
                                   console.log('click');
                                   vscode.postMessage({
                                    type: 'delete',
                                    id: element.parentElement.getAttribute("id")
                                  }, '*');
                               }
                        </script>
                        </html>`;
        selectionPanel.webview.html = html;
    };

    const clearRegistry = vscode.commands.registerCommand('extension.clearInfo', () => {
        inputSelections = [];
        outputSelections = [];
        if (selectionPanel) {
            selectionPanel.dispose();     
        }
    });


    context.subscriptions.push(searchRegistry);
    context.subscriptions.push(inputRegistry);
    context.subscriptions.push(outputRegistry);
    context.subscriptions.push(clearRegistry);
}