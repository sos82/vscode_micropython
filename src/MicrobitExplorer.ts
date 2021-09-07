'use babel';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { connected } from 'process';
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline')
var events = require('events');

export class MicrobitFileProvider implements vscode.TreeDataProvider<PythonFile> {
	private serialPort;
	private buff = "";
	private eventHasData = new events.EventEmitter();


	private _onDidChangeTreeData: vscode.EventEmitter<PythonFile | undefined | void> = new vscode.EventEmitter<PythonFile | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<PythonFile | undefined | void> = this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string | undefined) {
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: PythonFile): vscode.TreeItem {
		return element;
	}

	getChildren(element?: PythonFile): Thenable<PythonFile[]> {
		if (typeof this.serialPort === "undefined")
		{
			vscode.window.showInformationMessage("Serial isn't connected");
			return Promise.resolve([]);
		}
		/*
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('No dependency in empty workspace');
			return Promise.resolve([]);
		}
		*/

		this.GetFilesFromMicrobit();
		return Promise.resolve([]);

		/*

		if (element) {
			return Promise.resolve(this.getDepsInPackageJson(path.join(this.workspaceRoot, 'node_modules', element.label, 'package.json')));
		} else {
			const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
			if (this.pathExists(packageJsonPath)) {
				return Promise.resolve(this.getDepsInPackageJson(packageJsonPath));
			} else {
				vscode.window.showInformationMessage('Workspace has no package.json');
				return Promise.resolve([]);
			}
		}
		*/

	}

	async GetFilesFromMicrobit() : Promise<any>{
		let data = await this.SendAndRecv("import os\r\n");
		console.log(data)
		data = await this.SendAndRecv("os.listdir()\r\n");
		console.log(data)
	}

	/**
	 * Given the path to package.json, read all its dependencies and devDependencies.
	 */
	private getDepsInPackageJson(packageJsonPath: string): PythonFile[] {
		if (this.pathExists(packageJsonPath)) {
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

			const toDep = (moduleName: string, version: string): PythonFile => {
				if (this.pathExists(path.join(/*this.workspaceRoot*/ "A", 'node_modules', moduleName))) {
					return new PythonFile(moduleName, version, vscode.TreeItemCollapsibleState.Collapsed);
				} else {
					return new PythonFile(moduleName, version, vscode.TreeItemCollapsibleState.None, {
						command: 'extension.openPackageOnNpm',
						title: '',
						arguments: [moduleName]
					});
				}
			};

			const deps = packageJson.dependencies
				? Object.keys(packageJson.dependencies).map(dep => toDep(dep, packageJson.dependencies[dep]))
				: [];
			const devDeps = packageJson.devDependencies
				? Object.keys(packageJson.devDependencies).map(dep => toDep(dep, packageJson.devDependencies[dep]))
				: [];
			return deps.concat(devDeps);
		} else {
			return [];
		}
	}

	private pathExists(p: string): boolean {
		try {
			fs.accessSync(p);
		} catch (err) {
			return false;
		}

		return true;
	}

	private async SendAndRecv(cmd: string): Promise<any> {
		this.serialPort.write(cmd);

		let data = await this.WaitForReady();

		return data;
	}

	private async WaitForReady() : Promise<any> {
		return new Promise((resolve) => {
			let wait = setTimeout(() => {
				console.log("Timeout")
				this.eventHasData.removeAllListeners('data');
				clearTimeout(wait);
				resolve(null);
			}, 1000);

			this.eventHasData.on("data", function(this:any){
				if (this.buff.search(">>>") > -1)
				{
					clearTimeout(wait);
					this.eventHasData.removeAllListeners('data');
					let data = this.buff;
					this.buff = "";
					resolve(data);
				}
			}.bind(this));
	
	
	
	
		});
	
	}

	private OnRecvData() :void {
		this.buff += this.serialPort.read();
		this.eventHasData.emit("data")
	}
	
	private async ConnectToMicrobit(serialpath:string):Promise<void>{


		this.serialPort = new SerialPort(serialpath, {
			baudRate: 115200
		});

		this.serialPort.on('readable', this.OnRecvData.bind(this));		
		
		
		let data = await this.WaitForReady();
		if (data == null)
		{
			console.log("Retry send help()")
			data = await this.SendAndRecv("help()\r\n")
		}
		console.log(data)
		
		console.log("Connected")

		this.refresh();


	}
	

	public Connect() : void {
		vscode.window.showInformationMessage(`Successfully called add entry.`);
		
		SerialPort.list().then(
			ports => {
				ports.forEach(element => {
					if (element.manufacturer == "ARM" && element.pnpId.search("micro:bit") > -1)
					{
						this.ConnectToMicrobit(element.path);
						return;
					}
					
				});
			},
			err => {
				// TODO show error
			}
		);
		
		  
	}
}

export class PythonFile extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		private readonly version: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);

		this.tooltip = `${this.label}-${this.version}`;
		this.description = this.version;
	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
	};

	contextValue = 'dependency';
}