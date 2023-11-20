import * as path from 'path';
import { execSync } from 'child_process';

export const fixturePath = (uri: string) => path.join(__dirname, 'fixtures', uri);
export const phpUnitProject = (uri: string) => fixturePath(path.join('phpunit-stub', uri));
export const pestProject = (uri: string) => fixturePath(path.join('pest-stub', uri));
export const normalPath = (path: string) => {
    return path.replace(/^\w:/, (matched) => matched.toLowerCase());
};

export const getPhpUnitVersion = (): string => {
    const output = execSync('php vendor/bin/phpunit --version', {
        cwd: phpUnitProject(''),
    }).toString();

    const matched = output.match(/PHPUnit\s([\d\.]+)\s/);

    return matched![1];
};