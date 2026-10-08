// Turn an uploaded contract file into plain text.
import { createRequire } from 'node:module';
import mammoth from 'mammoth';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js'); // direct path avoids pdf-parse's debug-mode file read

export async function extractText(file) {
  const name = (file.originalname || '').toLowerCase();
  const type = file.mimetype || '';
  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    const out = await pdfParse(file.buffer);
    return out.text;
  }
  if (name.endsWith('.docx') || type.includes('wordprocessingml')) {
    const out = await mammoth.extractRawText({ buffer: file.buffer });
    return out.value;
  }
  if (type.startsWith('text/') || /\.(txt|md|rtf|html?)$/.test(name)) {
    return file.buffer.toString('utf8');
  }
  const e = new Error('Unsupported file type. Upload a PDF, Word (.docx) or text file, or paste the text instead.');
  e.status = 400;
  throw e;
}
