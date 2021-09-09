// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { MicrobitFile, MicrobitFileProvider } from './MicrobitExplorer';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
		? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "helloworld-sample" is now active!');

	const microbitFileProvider = new MicrobitFileProvider(rootPath);
	vscode.window.registerTreeDataProvider('MicrobitExplorer', microbitFileProvider);
	vscode.commands.registerCommand('MicrobitExplorer.refreshEntry', () => microbitFileProvider.refresh());
	vscode.commands.registerCommand('MicrobitExplorer.uploadEntry', () => microbitFileProvider.uploadFiles());
	vscode.commands.registerCommand('MicrobitExplorer.downloadEntry', () => microbitFileProvider.downloadFiles());
	vscode.commands.registerCommand('MicrobitExplorer.deleteEntry', (node: MicrobitFile) => microbitFileProvider.deleteFile(node));
	vscode.commands.registerCommand('MicrobitExplorer.connectEntry', () => microbitFileProvider.Connect());
	vscode.commands.registerCommand('MicrobitExplorer.resetEntry', () => microbitFileProvider.ResetDevice());
	vscode.commands.registerCommand('MicrobitExplorer.disconnectEntry', () => microbitFileProvider.DisconnectDevice());
}