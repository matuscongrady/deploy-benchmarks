import { PutObjectCommand } from '@aws-sdk/client-s3';
import { spreadsheets } from './clients';

const SHEET_ID = process.env.REPORTING_SHEET_ID ?? 'fixture-sheet';

/** The request that appends rows to the reporting spreadsheet. */
export function appendRowsRequest(range: string, rows: (string | number)[][]) {
  return {
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
    client: spreadsheets.context._options.rootUrl ?? 'https://sheets.googleapis.com/'
  };
}

/** The request that stores an export file in the reports bucket. */
export const exportFile = (key: string, body: string, contentType: string) =>
  new PutObjectCommand({ Bucket: process.env.REPORTS_BUCKET ?? 'shop-reports', Key: key, Body: body, ContentType: contentType });
