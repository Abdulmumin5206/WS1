import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const REPORTS_DIR = path.join(process.cwd(), 'data', 'reports');

// Ensure the reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

export async function GET() {
  try {
    // Read all report files
    const files = fs.readdirSync(REPORTS_DIR);
    const reports = files.map(file => {
      const content = fs.readFileSync(path.join(REPORTS_DIR, file), 'utf-8');
      return JSON.parse(content);
    });

    // Sort by last modified date
    reports.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    return NextResponse.json(reports);
  } catch (error) {
    console.error('Error reading reports:', error);
    return NextResponse.json({ error: 'Failed to read reports' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const report = await request.json();
    const fileName = `${report.id}.json`;
    const filePath = path.join(REPORTS_DIR, fileName);

    // Write the report to a file
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving report:', error);
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    const fileName = `${id}.json`;
    const filePath = path.join(REPORTS_DIR, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
  }
} 