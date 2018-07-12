'use strict';
import * as vscode from 'vscode';
import axios from 'axios';

let recPanel: vscode.WebviewPanel | undefined;

let selectionPanel: vscode.WebviewPanel | undefined ;

enum InputType {
    Any = "Any",
    Array = "Array",
    Function = "Function",
    number = "number",
    boolean = "boolean",
    string = "string",
    Object = "Object"
}

enum OutputType {
    Any = "Any",
    noReturn = "no return",
    Array = "Array",
    Function = "Function",
    number = "number",
    boolean = "boolean",
    string = "string",
    Object = "Object"
}

interface InputVariable {
    content: string,
    type: InputType;
}

let inputSelections: Array<InputVariable> = [];

let outputSelections: Array<OutputType> = [];

let useCurrentLine: boolean = false;

// this method is called when the extension is activated
// extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // console.log('intellisense-node is activated');

    const searchRegistry = vscode.commands.registerCommand('extension.searchAPI', () => {
        vscode.window.showInputBox({
            prompt: 'Please describe the task you want to accomplish, and optionally provide involved variables',
            value: 'I want a method to help me ${}'
        }).then(desc => {
            const editor = vscode.window.activeTextEditor;       
            if (editor !== undefined && desc !== undefined) {
                const position = editor.selection.active;
                const code = editor.document.getText();
                axios.post('http://localhost:8088/api/search', {
                    desc,
                    code,
                    useCurrentLine,
                    currentLine: position.line,
                    inputSelections: JSON.stringify(inputSelections),
                    outputSelections: JSON.stringify(outputSelections)
                  })
                  .then(function (response) {
                    updateRecView(response.data.html);
                  })
                  .catch(function (error) {
                    console.log(error);
                  });
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
        inputSelections.push({content: selectedText, type: InputType.Any});
        updateSelectionView();
    });

    const selectionRegistry = vscode.commands.registerCommand('extension.openSelection', () => {
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

    const changeInputType = (id: string, to: InputType) => {
        inputSelections[parseInt(id.substring(2))].type = to;
    };

    const changeOutputType = (to: Array<OutputType>) => {
        outputSelections = to;
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
                    case 'changeInputType':
                        changeInputType(e.id, e.to);
                        break;
                    case 'changeOutputType':
                        changeOutputType(e.to);
                        break;
                    case 'toggleCheckbox':
                        useCurrentLine = e.checked;
                        break;
                }
              }, undefined, context.subscriptions);
        }
        const inputList = inputSelections.map((selection, i) => `<li id=i${i}>${selection.content} <select id=ti${i} onchange="changeInputType(this)"> 
            <option value="Any" selected>type: Any</option> 
            <option value="Array">type: Array</option>
            <option value="Function">type: Function</option>
            <option value="number">type: number</option>
            <option value="boolean">type: boolean</option>
            <option value="string">type: string</option>
            <option value="Object">type: Object</option>
        </select>
      <a href="#" onclick="deleteListItem(this)">delete</a></li>
        `).join('');     
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
                                <select id="to" multiple="multiple" onchange="changeOutputType(this)"> 
                                    <option value="Any" selected>possible type: Any</option> 
                                    <option value="no return">possible type: no return</option>
                                    <option value="Array">possible type: Array</option>
                                    <option value="Function">possible type: Function</option>
                                    <option value="number">possible type: number</option>
                                    <option value="boolean">possible type: boolean</option>
                                    <option value="string">possible type: string</option>
                                    <option value="Object">possible type: Object</option>
                                </select>
                            <div>
                            <input type="checkbox" id="currentLineToggle" name="useCurrentLine" onchange="toggleCurrentLine(this)">   
                            <label for="currentLineToggle">API function shall be inserted into current cursor position </label></div>                    
                        </body>
                        <script>
                               const vscode = acquireVsCodeApi();
                               function deleteListItem(element) {
                                   vscode.postMessage({
                                    type: 'delete',
                                    id: element.parentElement.getAttribute("id"),
                                  }, '*');
                               }
                               function changeInputType(selector) {
                                    vscode.postMessage({
                                    type: 'changeInputType',
                                    id: selector.getAttribute("id"),
                                    to: selector.value,
                                  }, '*');
                               }
                               function changeOutputType(select) {
                                    var result = [];
                                    var options = select && select.options;
                                    var opt;
                                
                                    for (var i=0, iLen=options.length; i<iLen; i++) {
                                    opt = options[i];
                                
                                    if (opt.selected) {
                                        result.push(opt.value || opt.text);
                                    }
                                    }
                                    vscode.postMessage({
                                    type: 'changeOutputType',
                                    to: result,
                                  }, '*');
                               }
                               function toggleCurrentLine(checkbox) {
                                vscode.postMessage({
                                    type: 'toggleCurrentLine',
                                    value: checkbox.checked,
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
    context.subscriptions.push(selectionRegistry);
    context.subscriptions.push(clearRegistry);
}