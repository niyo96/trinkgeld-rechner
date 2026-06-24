import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync(process.argv[2], 'utf-8'));

const icon = (s) => (s === 'passed' ? '✅' : s === 'failed' ? '❌' : '⏭️');

const numSkipped = data.numPendingTests ?? 0;
const numFailed = data.numFailedTests ?? 0;
const numPassed = data.numPassedTests ?? 0;
const numTotal = data.numTotalTests ?? 0;

const overallIcon = data.success ? '✅' : '❌';
let md = `## ${overallIcon} Vitest Test Report\n\n`;

md += `### Summary\n\n`;
md += `| Gesamt | ✅ Bestanden | ❌ Fehlgeschlagen | ⏭️ Übersprungen |\n`;
md += `|-------:|------------:|------------------:|----------------:|\n`;
md += `| ${numTotal} | ${numPassed} | ${numFailed} | ${numSkipped} |\n\n`;

for (const file of data.testResults) {
  const relativePath = file.name.replace(/^.*\/src\//, 'src/');
  md += `### ${icon(file.status)} \`${relativePath}\`\n\n`;

  const groups = new Map();
  for (const test of file.assertionResults) {
    const suite = test.ancestorTitles.join(' › ') || '(root)';
    if (!groups.has(suite)) groups.set(suite, []);
    groups.get(suite).push(test);
  }

  for (const [suite, tests] of groups) {
    md += `**${suite}**\n\n`;
    md += `| | Testfall | Dauer |\n`;
    md += `|--|----------|------:|\n`;
    for (const test of tests) {
      const duration = test.duration != null ? `${test.duration.toFixed(1)} ms` : '—';
      const escaped = test.title.replace(/\|/g, '\\|');
      md += `| ${icon(test.status)} | ${escaped} | ${duration} |\n`;
    }
    md += '\n';

    if (tests.some((t) => t.failureMessages?.length)) {
      for (const test of tests.filter((t) => t.failureMessages?.length)) {
        md += `<details><summary>❌ Fehler: ${test.title}</summary>\n\n`;
        md += '```\n';
        md += test.failureMessages.join('\n');
        md += '\n```\n\n</details>\n\n';
      }
    }
  }
}

process.stdout.write(md);