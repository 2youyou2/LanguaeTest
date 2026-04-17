import process from 'node:process';

function collectBreakPoints(iterator, textLength) {
    const points = [];

    for (let index = iterator.next(); index !== -1; index = iterator.next()) {
        points.push(index);
    }

    if (points[points.length - 1] !== textLength) {
        points.push(textLength);
    }

    return points;
}

function readStdin() {
    return new Promise((resolve, reject) => {
        let data = '';

        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => {
            data += chunk;
        });
        process.stdin.on('end', () => {
            resolve(data);
        });
        process.stdin.on('error', reject);
    });
}

async function main() {
    const rawPayload = await readStdin();
    const payload = rawPayload ? JSON.parse(rawPayload) : {};

    const text = typeof payload.text === 'string' ? payload.text : '';
    const locale = typeof payload.locale === 'string' || payload.locale === null
        ? payload.locale
        : 'ar';

    if (!text) {
        process.stdout.write(JSON.stringify({
            lineBreaks: [],
            graphemeBreaks: [],
        }));
        return;
    }

    const {
        GraphemeClusterSegmenter,
        LineBreakStrictness,
        LineBreakWordOption,
        LineSegmenter,
        Locale,
    } = await import('icu');

    let contentLocale;
    try {
        contentLocale = locale ? Locale.fromString(locale) : Locale.unknown();
    } catch {
        contentLocale = Locale.unknown();
    }
    const lineBreaks = collectBreakPoints(
        LineSegmenter.autoWithOptions(contentLocale, {
            strictness: LineBreakStrictness.Normal,
            wordOption: LineBreakWordOption.Normal,
        }).segment(text),
        text.length
    );
    const graphemeBreaks = collectBreakPoints(
        new GraphemeClusterSegmenter().segment(text),
        text.length
    );

    process.stdout.write(JSON.stringify({ lineBreaks, graphemeBreaks }));
}

main().catch((error) => {
    const message = error && error.stack ? error.stack : String(error);
    process.stderr.write(message);
    process.exitCode = 1;
});
