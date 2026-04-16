/**
 * 在 https://texteditor.cn/ 富文本编辑区填入每条用例文本，仅截取「可编辑文字区域」保存为
 * assets/resources/references/case-01.png ~ case-29.png
 *
 * 用法: node scripts/capture_texteditor_refs.js
 */
/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const OUT_DIR = path.join(__dirname, '../assets/resources/references');
const CASE_FILE = path.join(__dirname, 'text_cases.json');

/** 默认用例（当 text_cases.json 不存在时使用） */
const DEFAULT_CASES = [
    '阿里 巴士 北京 成都 广州 杭州 南京 上海 深圳 天津 武汉 西安',
    '阿里 巴士 北京 成都 廣州 杭州 南京 上海 深圳 天津 武漢 西安',
    'Apple Banana Cherry Date Grape Lemon Mango Orange Peach Zebra',
    'ก ข ฃ ค ฅ ฆ ง จ ฉ ช ซ ญ ด ต ถ ท น บ ป ผ พ ฟ ภ ม ย ร ล ว ศ ส ห อ ฮ',
    'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي',
    'a árbol avión azul casa corazón niño ñandú sábado zapato',
    'あいうえお かきくけこ さしすせそ たちつてと なにぬねの',
    '가 나 다 라 마 바 사 아 자 차 카 타 파 하',
    'А Б В Г Д Е Ё Ж З И Й К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ Э Ю Я',
    'amico auto città èlite famiglia giovane italiano zucchero',
    'ami année école élève français garçon hôtel île zéro',
    '北京 Beijing 上海 Shanghai 广州 Guangzhou 深圳 Shenzhen',
    '重庆 重慶 广州 廣州 台北 臺北 软件 軟體 颜色 顏色',
    '中文 漢字 かな カナ Tokyo 東京 Osaka 大阪',
    '中文 한국어 Seoul 首尔 釜山 Busan 汉城 서울',
    '北京 Москва 上海 Санкт-Петербург 哈尔滨 Владивосток',
    '北京 Madrid 上海 Barcelona 深圳 Valencia 中文 español',
    '北京 Paris 上海 Lyon 广州 Marseille 中文 français',
    '北京 Roma 上海 Milano 广州 Napoli 中文 italiano',
    '北京 กรุงเทพ 上海 เชียงใหม่ 深圳 ภูเก็ต 中文 ไทย',
    '北京 دبي 上海 القاهرة 深圳 الرياض 中文 العربية',
    `中文English混排测试：北京Beijing、上海Shanghai、广州Guangzhou、深圳Shenzhen、杭州Hangzhou。
日本語テスト：東京Tokyo・大阪Osaka・京都Kyoto、かなカナ漢字ABC123。
한국어 테스트: 서울Seoul 부산Busan 인천Incheon, 가나다라마바사 + 漢字 + English.`,
    `Thaiไทยทดลองร่วมกับ中文和English：กรุงเทพมหานครเชียงใหม่ภูเก็ตสุราษฎร์ธานี
Arabicالعربيةاختبارمع中文English: القاهرةالرياضدبيأبودبيالدوحة
EspañolFrançaisItalianoРусский日本語한국어中文EnglishLongMixedSequence_ABCDEFGHIJKLMNOPQRSTUVWXYZ_1234567890`,
    `1) 北京/Beijing - 2) 東京/Tokyo - 3) 서울/Seoul - 4) Москва/Moscow - 5) กรุงเทพ/Bangkok
6) القاهرة/Cairo - 7) Madrid - 8) Roma - 9) Paris - 10) 深圳/Shenzhen
符号测试：()[]{}<>«»“”‘’【】——···！？!?,.;: @#&*+=/%\\ | ~`,
    `Arabic RTL: مرحبا بالعالم ١٢٣٤٥ ، ثم English ABC 67890 ، 再接中文段落。
Mixed order: Start-中文-العربية-English-日本語-한국어-End.
Bidirectional check: السعر 99.50 USD，折扣20%，最终价￥568。`,
    `NFC/NFD: é é ñ ñ ü ü à à ç ç
Français: élève déjà Noël façade rôle où très bientôt.
Español: pingüino corazón acción niño jalapeño camión.`,
    `半角: ABCabc123()[]{}!?
全角: ＡＢＣａｂｃ１２３（）［］｛｝！？
日文混合: ｶﾀｶﾅ カタカナ ひらがな 漢字，韩文: ﾊﾝｸﾞﾙ 한글`,
    `Emoji: 😀😃😄😁😆😅😂🤣😊😇
ZWJ: 👨‍👩‍👧‍👦 👩‍💻 🧑‍🚀 🧑‍🔬 🧑‍🍳
Flags: 🇨🇳 🇺🇸 🇯🇵 🇰🇷 🇹🇭 🇸🇦 🇪🇸 🇷🇺 🇮🇹 🇫🇷`,
    `LongToken: SuperLongMixedToken中文English日本語한국어ไทยالعربيةEspañolРусскийItalianoFrançais1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ
SoftBreakHint: 中文\u200BEnglish\u200B日本語\u200B한국어\u200Bไทย\u200Bالعربية\u200BEspañol
URL-like: https://example.com/中文/path/العربية/日本語/very-long-segment-for-wrap-testing`,
];

function loadCaseTexts() {
    if (!fs.existsSync(CASE_FILE)) {
        console.log(`Case file not found, fallback defaults: ${CASE_FILE}`);
        return DEFAULT_CASES;
    }

    const raw = fs.readFileSync(CASE_FILE, 'utf8');
    const parsed = JSON.parse(raw);

    // 支持两种格式：
    // 1) ["text1", "text2"]
    // 2) [{ "title": "...", "text": "..." }, ...]
    let list = [];
    if (Array.isArray(parsed)) {
        if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
            list = parsed
                .map((x) => (typeof x.text === 'string' ? x.text : ''))
                .filter((x) => x.length > 0);
        } else {
            list = parsed.filter((x) => typeof x === 'string');
        }
    }

    if (list.length === 0) {
        throw new Error(`text_cases.json 无有效内容: ${CASE_FILE}`);
    }

    console.log(`Loaded ${list.length} cases from ${CASE_FILE}`);
    return list;
}

function caseName(i) {
    const n = i + 1;
    return n < 10 ? `case-0${n}.png` : `case-${n}.png`;
}

async function main() {
    const CASES = loadCaseTexts();
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 900, height: 700 },
        locale: 'zh-CN',
    });
    const page = await context.newPage();

    await page.goto('https://texteditor.cn/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    const selectors = [
        '.ck-editor__main .ck-editor__editable',
        '.ck-editor__editable',
        '[role="textbox"]',
    ];
    let editor = null;
    for (const sel of selectors) {
        const loc = page.locator(sel).first();
        try {
            await loc.waitFor({ state: 'visible', timeout: 15000 });
            editor = loc;
            console.log('Using editor selector:', sel);
            break;
        } catch {
            /* try next */
        }
    }
    if (!editor) {
        await browser.close();
        throw new Error('找不到富文本编辑区，请检查 texteditor.cn 页面结构是否变更');
    }

    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

    for (let i = 0; i < CASES.length; i++) {
        const text = CASES[i];
        await editor.click();
        await page.keyboard.press(`${mod}+A`);
        await page.keyboard.press('Backspace');
        await page.keyboard.insertText(text);
        await page.waitForTimeout(400);

        const outPath = path.join(OUT_DIR, caseName(i));
        await editor.screenshot({ path: outPath });
        console.log('Wrote', outPath);
    }

    await browser.close();
    console.log('Done. 共', CASES.length, '张。请在 Cocos 中刷新 resources/references 以生成 .meta');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
