import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

export interface RetrievedFileContext {
  filePath: string;
  content: string;
  lineCount: number;
}

export interface GitDiffSummary {
  branchName: string;
  changedFiles: string[];
  rawDiff: string;
}

export class ContextRetriever {
  private baseDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = path.resolve(baseDir);
  }

  /**
   * Safely reads a file within allowed project roots
   */
  public readFileSafe(relativeOrAbsolutePath: string): RetrievedFileContext | null {
    try {
      const resolved = path.isAbsolute(relativeOrAbsolutePath)
        ? path.resolve(relativeOrAbsolutePath)
        : path.resolve(this.baseDir, relativeOrAbsolutePath);

      if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
        return null;
      }

      const content = fs.readFileSync(resolved, 'utf-8');
      return {
        filePath: resolved,
        content,
        lineCount: content.split('\n').length
      };
    } catch {
      return null;
    }
  }

  /**
   * Searches for files matching a pattern in a given directory
   */
  public findFiles(dir: string, extension: string = '.ts'): string[] {
    const results: string[] = [];
    const targetDir = path.resolve(this.baseDir, dir);

    if (!fs.existsSync(targetDir)) return results;

    const traverse = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
            traverse(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
          results.push(path.relative(this.baseDir, fullPath));
        }
      }
    };

    traverse(targetDir);
    return results;
  }

  /**
   * Reads Git diff if running inside a Git repository
   */
  public getGitDiff(targetRef: string = 'HEAD'): GitDiffSummary {
    try {
      const branchName = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.baseDir,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();

      const diffStat = execSync(`git diff --name-only ${targetRef}`, {
        cwd: this.baseDir,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();

      const changedFiles = diffStat ? diffStat.split('\n').filter(Boolean) : [];

      const rawDiff = execSync(`git diff ${targetRef}`, {
        cwd: this.baseDir,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore']
      });

      return {
        branchName,
        changedFiles,
        rawDiff
      };
    } catch {
      return {
        branchName: 'unknown',
        changedFiles: [],
        rawDiff: ''
      };
    }
  }

  /**
   * Retrieves architecture wiki pages or requirement specs
   */
  public getArchitectureReference(docName: string): string | null {
    const candidates = [
      path.join(this.baseDir, 'wiki', docName),
      path.join(this.baseDir, 'wiki', `${docName}.md`),
      path.join(this.baseDir, '..', 'wiki', docName),
      path.join(this.baseDir, '..', 'wiki', `${docName}.md`)
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return fs.readFileSync(cand, 'utf-8');
      }
    }
    return null;
  }
}
