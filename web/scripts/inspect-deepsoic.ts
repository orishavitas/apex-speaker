import * as XLSX from 'xlsx';
import * as os from 'os';
import * as path from 'path';

const CLONE_DIR = path.join(os.tmpdir(), 'deepsoic-loudspeaker-db');
const XLSX_FILE = path.join(CLONE_DIR, 'driver data.xlsx');

const wb = XLSX.readFile(XLSX_FILE);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rawArr = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][];
console.log('Array row 0:', rawArr[0]);
console.log('Array row 1:', rawArr[1]);
console.log('Array row 2:', rawArr[2]);
