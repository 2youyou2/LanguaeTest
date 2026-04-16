import { EDITOR, NATIVE } from "cc/env";

export type WrapMeasureWidth = (segment: string) => number;

/**
 * 在 Cocos Creator 编辑器环境中，我们优先通过插件消息（icu-main）在主进程中获取 ICU 数据，
 * 这样可以避免在场景 Webview 环境中因复杂的 WASM 初始化路径而失败。
 */
async function collectIcuBreakData(text: string, locale: string | null) {

    if (EDITOR) {
        const editorMessageApi = globalThis.Editor?.Message

        try {
            return await editorMessageApi.request('icu-main', 'get-break-points', {
                text,
                locale,
            }) as { lineBreaks: number[], graphemeBreaks: number[] };
        } catch (error: any) {
            throw new Error(
                `[rtl-visual-wrap] 无法从 "icu-main" 扩展请求 ICU 断点数据: ${error?.message || error}`
            );
        }
    }

    if (NATIVE) {
        let lineBreaks = jsb.allBreakPos(text)
        if (lineBreaks && lineBreaks[0] !== 0) {
            lineBreaks.unshift(0)
        }
        return {
            lineBreaks: lineBreaks
        }
    }

    debugger
    console.error('collectIcuBreakData not support on platform')
}


const RTL_CHAR_REG = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g;
const LTR_CHAR_REG = /[A-Za-z\u00C0-\u00FF\u0100-\u017F\u0180-\u024F\u0370-\u03FF]/;

function isRTLText(text: string) {
    return !!text.match(RTL_CHAR_REG);
}

function isLTRText(text: string) {
    return !!text.match(LTR_CHAR_REG);
}


/**
 * 核心折行逻辑：结合 ICU 断点和渲染引擎测量的 RTL 折行算法
 * 
 * 此方法返回一个字符串数组。每个行内部的字符顺序不会被手动反转，
 * 仅仅是行的分组发生了变化。
 */
export async function wrapRtlTextWithIcu(
    text: string,
    {
        locale = 'ar',
        maxWidth,
        measureWidth,
    }
) {
    if (!text) {
        return [];
    }

    if (typeof maxWidth !== 'number' || maxWidth <= 0) {
        throw new TypeError('maxWidth 必须是一个正数');
    }

    if (typeof measureWidth !== 'function') {
        throw new TypeError('measureWidth 必须是一个函数');
    }

    const { lineBreaks, graphemeBreaks } = await collectIcuBreakData(text, locale);

    // lineBreaks:
    //   语言学上合法的断行位置。
    // graphemeBreaks:
    //   如果没有任何合法断行位置符合宽度要求，则作为安全的回退边界。
    //
    // 我们优先使用 ICU 行断点，仅在没有合法断点能放入宽度时才回退到字符簇，
    // 以避免在中间拆分代理对（surrogate pairs）或组合序列。
    let lines: string[] = [];
    // debugger;

    // return lines

    function lineToText(line: string[]) {
        return line.join('')
    }

    function lineToRTLText(line: string[]) {
        line.push('\u200F');
        let text = line.join('')
        return text.trim()
    }

    let words = []
    for (let i = 0; i < lineBreaks.length - 1; i++) {
        words.push(text.substring(lineBreaks[i], lineBreaks[i + 1]));
    }

    // debugger

    const isRTL = isRTLText(text);
    const isLTR = isLTRText(text);
    if (isRTL) {
        // rtl 和 ltr 混排
        if (isLTR) {
            // 分离 rtl 和 ltr text
            let texts = []

            let lineWords: string[] = [];
            let lastIsLTR = undefined
            words.forEach((text) => {
                const isLTR = isLTRText(text);

                if (isLTR !== lastIsLTR) {
                    lineWords = []
                    texts.push(lineWords)
                }

                lineWords.push(text);

                lastIsLTR = isLTR
            });

            // console.log(texts)

            let line = []
            lastIsLTR = undefined;

            let lastPos = 0;

            for (let i = texts.length - 1; i >= 0; i--) {
                let _text = texts[i]
                for (let j = 0; j < _text.length; j++) {
                    if (measureWidth(lineToRTLText(line.concat()) + _text[j]) <= maxWidth) {
                        if (isLTRText(_text[j])) {
                            line.unshift(_text[j])
                            lastIsLTR = true
                            lastPos = 0;
                        }
                        else {
                            line.splice(lastPos++, 0, _text[j])
                        }
                    }
                    else {
                        lines.push(lineToRTLText(line))
                        lastPos = 0
                        j--;
                        line = []
                    }
                }
            }

            if (line) {
                lines.push(lineToRTLText(line));
            }

        }
        // rtl
        else {
            let line = []

            for (let i = 0; i < words.length; i++) {
                if (measureWidth(lineToRTLText(line.concat()) + words[i]) <= maxWidth) {
                    line.push(words[i])
                }
                else {
                    lines.push(lineToRTLText(line))
                    line = [words[i]]
                }
            }

            if (line) {
                lines.push(lineToRTLText(line));
            }
        }

        return lines;
    }
    // ltr
    else {
        let line = []

        for (let i = 0; i < words.length; i++) {
            if (measureWidth(lineToText(line) + words[i]) <= maxWidth) {
                line.push(words[i])
            }
            else {
                lines.push(lineToText(line))
                line = [words[i]]
            }
        }

        if (line) {
            lines.push(lineToText(line));
        }
    }

    return lines;
}

/**
 * 便捷方法：直接返回折行并拼接后的字符串，适用于 Label.string 赋值
 */
export async function wrapRtlTextToString(
    text: string,
    options
) {
    const lines = await wrapRtlTextWithIcu(text, options);
    return lines.join('\n');
}
