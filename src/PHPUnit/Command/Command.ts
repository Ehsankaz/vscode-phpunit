import { SpawnOptions } from 'node:child_process';
import parseArgsStringToArgv from 'string-argv';
import { Configuration, IConfiguration } from '../Configuration';
import { Result } from '../ProblemMatcher';
import { parseValue } from '../utils';
import { Path, PathReplacer } from './PathReplacer';

export abstract class Command {
    private arguments = '';
    private readonly pathReplacer: PathReplacer;

    constructor(protected configuration: IConfiguration = new Configuration(), private options: SpawnOptions = {}) {
        this.pathReplacer = this.resolvePathReplacer(options, configuration);
    }

    setArguments(args: string) {
        this.arguments = args.trim();

        return this;
    }

    replacePath(result: Result) {
        if ('locationHint' in result) {
            result.locationHint = this.pathReplacer.toLocal(result.locationHint);
        }

        if ('file' in result) {
            result.file = this.pathReplacer.toLocal(result.file);
        }

        if ('details' in result) {
            result.details = result.details.map(({ file, line }) => ({
                file: this.pathReplacer.toLocal(file),
                line,
            }));
        }

        return result;
    }

    apply() {
        const [cmd, ...args] = [...this.getPrefix(), ...this.executable()]
            .filter((input: string) => !!input)
            .map((input: string) => this.pathReplacer.replacePathVariables(input).trim());

        return { cmd, args, options: this.options };
    }

    protected executable() {
        return this.setParaTestFunctional([this.getPhp(), this.getPhpUnit(), ...this.getArguments()]);
    }

    protected resolvePathReplacer(options: SpawnOptions, configuration: IConfiguration): PathReplacer {
        return new PathReplacer(options, configuration.get('paths') as Path);
    }

    private getPrefix() {
        return parseArgsStringToArgv((this.configuration.get('command') as string) ?? '');
    }

    private getPhpUnit() {
        return this.pathReplacer.toRemote(this.configuration.get('phpunit') as string ?? '');
    }

    private getPhp() {
        return this.pathReplacer.toRemote(this.configuration.get('php') as string ?? '');
    }

    private getArguments(): string[] {
        const { _, ...argv } = this.configuration.getArguments(this.arguments);

        return Object.entries(argv)
            .filter(([key]) => !['teamcity', 'colors', 'testdox', 'c'].includes(key))
            .reduce(
                (args: any, [key, value]) => [...parseValue(key, value), ...args],
                _.map((v) => (typeof v === 'number' ? v : decodeURIComponent(v))),
            )
            .map((arg: string) => /^--filter/.test(arg) ? arg : this.pathReplacer.toRemote(arg))
            .concat('--colors=never', '--teamcity');
    }

    private setParaTestFunctional(args: string[]) {
        return this.isParaTestFunctional(args) ? [...args, '-f'] : args;
    }

    private isParaTestFunctional(args: string[]) {
        return (
            !!this.getPhpUnit().match(/paratest/) &&
            args.some((arg: string) => !!arg.match(/--filter/))
        );
    }
}

export class LocalCommand extends Command {
}

export class RemoteCommand extends Command {
    protected executable() {
        return [
            super.executable().map((input) => (/^-/.test(input) ? `'${input}'` : input)).join(' '),
        ];
    }
}