import * as parser from 'yargs-parser';
import { Arguments } from 'yargs-parser';

export class EscapeValue {
    private values = {
        escape: ['||', "|'", '|n', '|r', '|]', '|['],
        unescape: ['|', "'", '\n', '\r', ']', '['],
    };

    private patterns: { unescape: RegExp[]; escape: RegExp[] };

    constructor() {
        this.patterns = {
            escape: this.toRegExp(this.values.escape),
            unescape: this.toRegExp(this.values.unescape),
        };
    }

    public escape(value: string | number | object) {
        return this.doEscape(value, this.patterns.unescape, this.values.escape);
    }

    public unescape(value: string | number | object) {
        return this.doEscape(value, this.patterns.escape, this.values.unescape);
    }

    private doEscape(value: string | number | object, from: RegExp[], to: string[]) {
        if (typeof value !== 'string') {
            return value;
        }

        for (const x in from) {
            value = value.replace(from[x], to[x]);
        }

        return value;
    }

    private toRegExp(values: string[]) {
        return values.map((str) => {
            str = str.replace(/([|\]\[])/g, (m) => `\\${m}`);

            return new RegExp(str, 'g');
        });
    }
}

export class TeamcityParser {
    private readonly teamcityPattern = /^\s*#+teamcity/;
    private readonly timeAndMemoryPattern =
        /Time: (?<time>[\d+:\.]+), Memory: (?<memory>[\d\.]+\s\w+)/;

    constructor(private escapeValue: EscapeValue) {}

    public parse(text: string) {
        if (this.isTeamcity(text)) {
            return this.parseTeamcity(text);
        }

        if (this.isTimeAndMemory(text)) {
            return this.parseTimeAnMemory(text);
        }

        return undefined;
    }

    private isTimeAndMemory(text: string) {
        return !!text.match(this.timeAndMemoryPattern);
    }

    private isTeamcity(text: string): boolean {
        return !!text.match(this.teamcityPattern);
    }

    private parseTimeAnMemory(text: string) {
        const { time, memory } = this.timeAndMemoryPattern.exec(text)!.groups!;

        return { time, memory };
    }

    private parseTeamcity(text: string) {
        text = text
            .trim()
            .replace(this.teamcityPattern, '')
            .replace(/^\[|\]$/g, '');

        const { _, $0, ...argv } = this.unescapeArgv(this.toTeamcityArgv(text));

        return { ...argv, ...this.parseLocationHint(argv), ...this.parseDetails(argv) };
    }

    private parseDetails(argv: Pick<Arguments, string | number>) {
        if (!argv.details) {
            return {};
        }

        return {
            details: argv.details
                .trim()
                .split(/\r\n|\n/g)
                .filter((detail: string) => !!detail)
                .map((detail: string) => {
                    const { file, line } = /(?<file>.+):(?<line>\d+)$/g.exec(detail)!.groups!;

                    return { file, line: parseInt(line, 10) };
                }),
        };
    }

    private parseLocationHint(argv: Pick<Arguments, string | number>) {
        if (!argv.locationHint) {
            return {};
        }

        const locationHint = argv.locationHint;
        const split = locationHint
            .replace(/^php_qn:\/\//, '')
            .replace(/::\\/g, '::')
            .split('::');
        const file = split.shift();
        const id = split.join('::');

        return { id, file };
    }

    private unescapeArgv(argv: Pick<Arguments, string | number>) {
        for (const x in argv) {
            argv[x] = this.escapeValue.unescape(argv[x]);
        }

        return argv;
    }

    private toTeamcityArgv(text: string) {
        const [eventName, ...args] = this.parseArgv(text)._;
        const command = [
            `--event='${eventName}'`,
            ...args.map((parameter) => `--${parameter}`),
        ].join(' ');

        return this.parseArgv(command);
    }

    private parseArgv(text: string): Arguments {
        return parser(text);
    }
}

export const teamcityParser = new TeamcityParser(new EscapeValue());
