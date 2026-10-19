#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DevilsAdvocateOrchestrator } from '../engine/orchestrator.ts';

function readArgOrFile(arg?: string): string {
  if (!arg) return '';
  if (fs.existsSync(arg) && fs.statSync(arg).isFile()) {
    return fs.readFileSync(arg, 'utf-8');
  }
  return arg;
}

function printUsage() {
  console.log(`
👹 Devil's Advocate — Adversarial Software Engineering CLI

Usage:
  devils-advocate pr <diff-file-or-branch> [pr-title] [--json]
  devils-advocate req <requirement-file-or-text> [story-title] [--json]
  devils-advocate premortem <sprint-or-feature-name> [context-text-or-file] [--json]
  devils-advocate release <version-tag> [scope-file-or-text] [--json]
  devils-advocate incident <incident-file-or-text> [title] [--json]
  devils-advocate radar [list | audit <context-file>]
  devils-advocate ask <investigation-query> [context] [--json]

Options:
  --json    Output typed JSON conforming to schema instead of Markdown report
  --help    Show this message
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const isJson = args.includes('--json');
  const filteredArgs = args.filter(a => a !== '--json');
  const command = filteredArgs[0];

  const orchestrator = new DevilsAdvocateOrchestrator(process.cwd());

  try {
    let result;

    switch (command) {
      case 'pr': {
        const diffOrFile = filteredArgs[1] || 'HEAD';
        const title = filteredArgs[2] || `PR Review on ${diffOrFile}`;
        let diffContent = readArgOrFile(diffOrFile);

        let changedFiles: string[] = [];
        if (!diffContent) {
          const gitDiff = orchestrator.contextRetriever.getGitDiff(diffOrFile);
          diffContent = gitDiff.rawDiff || 'No local diff detected';
          changedFiles = gitDiff.changedFiles;
        }

        result = orchestrator.investigatePullRequest(title, diffContent, changedFiles);
        break;
      }

      case 'req': {
        const reqArg = filteredArgs[1];
        if (!reqArg) {
          console.error('Error: Please provide requirement file path or text.');
          process.exit(1);
        }
        const title = filteredArgs[2] || (fs.existsSync(reqArg) ? path.basename(reqArg) : 'Requirement Review');
        const specContent = readArgOrFile(reqArg);
        result = orchestrator.challengeRequirement(title, specContent);
        break;
      }

      case 'premortem': {
        const name = filteredArgs[1] || 'Upcoming Sprint Release';
        const context = readArgOrFile(filteredArgs[2]) || 'Standard sprint backlog scope';
        result = orchestrator.runSprintPremortem(name, context);
        break;
      }

      case 'release': {
        const version = filteredArgs[1] || 'v1.0.0-rc1';
        const scope = readArgOrFile(filteredArgs[2]) || `Release candidate audit for ${version}`;
        result = orchestrator.assessReleaseRisk(version, scope);
        break;
      }

      case 'incident': {
        const incArg = filteredArgs[1];
        if (!incArg) {
          console.error('Error: Please provide incident report file path or text.');
          process.exit(1);
        }
        const title = filteredArgs[2] || 'Postmortem Audit';
        const content = readArgOrFile(incArg);
        result = orchestrator.detectIncidentPatterns(title, content);
        break;
      }

      case 'radar': {
        const sub = filteredArgs[1] || 'list';
        if (sub === 'audit') {
          const auditContent = readArgOrFile(filteredArgs[2]);
          const audit = orchestrator.assumptionRadar.auditAssumptionsAgainstContext(auditContent);
          if (isJson) {
            console.log(JSON.stringify(audit, null, 2));
          } else {
            console.log(`# 📡 Assumption Radar Audit Result`);
            console.log(`- Challenged: ${audit.challenged.length}`);
            console.log(`- Invalidated: ${audit.invalidated.length}`);
            console.log(`- Intact: ${audit.intact.length}\n`);
            for (const a of [...audit.invalidated, ...audit.challenged]) {
              console.log(`- [${a.id}] ${a.description} -> Impact if false: ${a.impactIfFalse}`);
            }
          }
          return;
        } else {
          const assumptions = orchestrator.assumptionRadar.exportRegistry();
          if (isJson) {
            console.log(JSON.stringify(assumptions, null, 2));
          } else {
            console.log(`# 📡 Active Project Assumption Radar (${assumptions.length} items)\n`);
            for (const a of assumptions) {
              console.log(`### [${a.id}] ${a.description}`);
              console.log(`- Status: ${a.validationStatus} | Confidence: ${a.confidence} | Impact if false: ${a.impactIfFalse}`);
              console.log(`- Source: ${a.source}`);
              console.log(`- Components: ${a.affectedComponents.join(', ')}\n`);
            }
          }
          return;
        }
      }

      case 'ask': {
        const query = filteredArgs[1];
        if (!query) {
          console.error('Error: Please provide a question or hypothesis to investigate.');
          process.exit(1);
        }
        const context = readArgOrFile(filteredArgs[2]) || '';
        result = orchestrator.investigateOnDemand(query, context);
        break;
      }

      default:
        console.error(`Unknown command: "${command}". Run "devils-advocate --help" for options.`);
        process.exit(1);
    }

    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(orchestrator.formatAssessmentReport(result));
    }
  } catch (err: any) {
    console.error('Execution error:', err?.message || err);
    process.exit(1);
  }
}

main();
