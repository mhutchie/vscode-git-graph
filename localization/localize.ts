
import * as path from 'path';
import * as vscode from 'vscode';
/** language data */
const localeData = require(path.join(__dirname, `${vscode.env.language}.json`));

/** made tilte in language,easy to new gay used git.
 * @param word title or option word
 * @returns word after localize
 */
export const localize:( word:string) =>string = 
! localeData
? word=> localeData[word] ?? word
: word=> word