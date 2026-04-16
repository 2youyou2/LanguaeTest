import { _decorator, Color, Component, Graphics, Label, Node, Size, Sprite, SpriteFrame, Texture2D, UITransform, Vec3, Widget, resources } from 'cc';
import { ICULabel } from './icu/icu-label';
const { ccclass, property } = _decorator;

type CaseItem = {
    title: string;
    text: string;
    reference?: string;
};

@ccclass('LanguageSortValidation')
export class LanguageSortValidation extends Component {
    @property({ type: Label, tooltip: '可选：指定要展示测试文本的 Label；不填则使用当前节点的 Label。' })
    public targetLabel: Label | null = null;

    @property({ tooltip: '每条测试用例展示时长（秒）' })
    public intervalSeconds = 2;

    @property({ tooltip: '启用 ICU 预换行：关闭 cc.Label 自动换行，仅保留 overflow 的裁剪/缩放/高度适配。' })
    public forceWrapText = true;

    @property({ tooltip: '是否在控制台打印切换日志（用例 + 文本长度）' })
    public enableDebugLog = true;

    @property({ tooltip: '强制使用测试尺寸（避免原 Label 太窄导致误判）' })
    public useTestAreaSize = true;

    @property({ tooltip: '测试区域宽度（像素）' })
    public testAreaWidth = 640;

    @property({ tooltip: '测试区域高度（像素）' })
    public testAreaHeight = 260;

    @property({ tooltip: '调试：自动将 Label 节点居中到父节点中心' })
    public debugAutoCenterLabel = false;

    @property({ tooltip: '调试：居中时临时禁用 Widget（避免被布局系统拉走）' })
    public debugDisableWidgetWhenCentering = true;

    @property({ tooltip: '调试：显示半透明边框线（用于观察可见区域和裁剪）' })
    public debugShowBorder = false;

    @property({ type: Sprite, tooltip: '参考图片 Sprite（放在文本下方）。会按用例索引切换对应 SpriteFrame。' })
    public referenceImageSprite: Sprite | null = null;

    @property({ type: [SpriteFrame], tooltip: '参考图片列表（与用例索引一一对应）。可只配置重点用例，未配置则隐藏图片。' })
    public referenceImageFrames: SpriteFrame[] = [];

    @property({ tooltip: '自动从 resources 目录加载参考图（按文件名排序）' })
    public autoLoadReferenceFrames = true;

    @property({ tooltip: 'resources 下参考图目录，例如 references' })
    public referenceResourceDir = 'references';

    @property({ type: Label, tooltip: '参考说明 Label（可放在参考图下方，显示来源链接/备注）' })
    public referenceInfoLabel: Label | null = null;

    @property({ tooltip: '当当前用例缺少参考图时打印告警日志' })
    public warnWhenReferenceMissing = true;

    @property({ tooltip: '打印参考图加载诊断日志（排查 resources 未命中）' })
    public verboseReferenceLog = true;

    private _currentIndex = 0;
    private _baseSize: Size | null = null;
    private _baseFontSize = 0;
    private _baseLineHeight = 0;
    private _referenceFrameByCase: Array<SpriteFrame | null> = [];
    private _icuLabel: ICULabel | null = null;
    private _pauseButtonNode: Node | null = null;
    private _pauseButtonGraphics: Graphics | null = null;
    private _pauseButtonLabel: Label | null = null;
    private _isPaused = false;

    private readonly _cases: CaseItem[] = [
        // 单语言验证
        { title: '中文-简体', text: '阿里 巴士 北京 成都 广州 杭州 南京 上海 深圳 天津 武汉 西安', reference: '参考: CLDR/Unicode collation zh-Hans' },
        { title: '中文-繁體', text: '阿里 巴士 北京 成都 廣州 杭州 南京 上海 深圳 天津 武漢 西安', reference: '参考: CLDR/Unicode collation zh-Hant' },
        { title: '英文', text: 'Apple Banana Cherry Date Grape Lemon Mango Orange Peach Zebra', reference: '参考: UCA + en locale' },
        { title: '泰语', text: 'ก ข ฃ ค ฅ ฆ ง จ ฉ ช ซ ญ ด ต ถ ท น บ ป ผ พ ฟ ภ ม ย ร ล ว ศ ส ห อ ฮ', reference: '参考: UCA + th locale' },
        { title: '阿拉伯语', text: 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي', reference: '参考: UCA + ar locale (RTL)' },
        { title: '西班牙语', text: 'a árbol avión azul casa corazón niño ñandú sábado zapato', reference: '参考: UCA + es locale' },
        { title: '日文', text: 'あいうえお かきくけこ さしすせそ たちつてと なにぬねの', reference: '参考: UCA + ja locale' },
        { title: '韩文', text: '가 나 다 라 마 바 사 아 자 차 카 타 파 하', reference: '参考: UCA + ko locale' },
        { title: '俄语', text: 'А Б В Г Д Е Ё Ж З И Й К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ Э Ю Я', reference: '参考: UCA + ru locale' },
        { title: '意大利语', text: 'amico auto città èlite famiglia giovane italiano zucchero', reference: '参考: UCA + it locale' },
        { title: '法语', text: 'ami année école élève français garçon hôtel île zéro', reference: '参考: UCA + fr locale' },

        // 混排验证
        { title: '中英混排', text: '北京 Beijing 上海 Shanghai 广州 Guangzhou 深圳 Shenzhen' },
        { title: '简繁混排', text: '重庆 重慶 广州 廣州 台北 臺北 软件 軟體 颜色 顏色' },
        { title: '中日混排', text: '中文 漢字 かな カナ Tokyo 東京 Osaka 大阪' },
        { title: '中韩混排', text: '中文 한국어 Seoul 首尔 釜山 Busan 汉城 서울' },
        { title: '中俄混排', text: '北京 Москва 上海 Санкт-Петербург 哈尔滨 Владивосток' },
        { title: '中西混排', text: '北京 Madrid 上海 Barcelona 深圳 Valencia 中文 español' },
        { title: '中法混排', text: '北京 Paris 上海 Lyon 广州 Marseille 中文 français' },
        { title: '中意混排', text: '北京 Roma 上海 Milano 广州 Napoli 中文 italiano' },
        { title: '中泰混排', text: '北京 กรุงเทพ 上海 เชียงใหม่ 深圳 ภูเก็ต 中文 ไทย' },
        { title: '中阿混排', text: '北京 دبي 上海 القاهرة 深圳 الرياض 中文 العربية' },
        {
            title: '多语混排-1（长文本+手动换行）',
            text: `中文English混排测试：北京Beijing、上海Shanghai、广州Guangzhou、深圳Shenzhen、杭州Hangzhou。
日本語テスト：東京Tokyo・大阪Osaka・京都Kyoto、かなカナ漢字ABC123。
한국어 테스트: 서울Seoul 부산Busan 인천Incheon, 가나다라마바사 + 漢字 + English.`,
        },
        {
            title: '多语混排-2（长词自动换行）',
            text: `Thaiไทยทดลองร่วมกับ中文和English：กรุงเทพมหานครเชียงใหม่ภูเก็ตสุราษฎร์ธานี
Arabicالعربيةاختبارمع中文English: القاهرةالرياضدبيأبودبيالدوحة
EspañolFrançaisItalianoРусский日本語한국어中文EnglishLongMixedSequence_ABCDEFGHIJKLMNOPQRSTUVWXYZ_1234567890`,
        },
        {
            title: '多语混排-3（标点/数字/符号换行）',
            text: `1) 北京/Beijing - 2) 東京/Tokyo - 3) 서울/Seoul - 4) Москва/Moscow - 5) กรุงเทพ/Bangkok
6) القاهرة/Cairo - 7) Madrid - 8) Roma - 9) Paris - 10) 深圳/Shenzhen
符号测试：()[]{}<>«»“”‘’【】——···！？!?,.;: @#&*+=/%\\ | ~`,
        },
        {
            title: '复杂专项-1（RTL + LTR + 数字）',
            text: `Arabic RTL: مرحبا بالعالم ١٢٣٤٥ ، ثم English ABC 67890 ، 再接中文段落。
Mixed order: Start-中文-العربية-English-日本語-한국어-End.
Bidirectional check: السعر 99.50 USD，折扣20%，最终价￥568。`,
        },
        {
            title: '复杂专项-2（组合字符/重音）',
            text: `NFC/NFD: é é ñ ñ ü ü à à ç ç
Français: élève déjà Noël façade rôle où très bientôt.
Español: pingüino corazón acción niño jalapeño camión.`,
        },
        {
            title: '复杂专项-3（全角/半角/兼容字符）',
            text: `半角: ABCabc123()[]{}!?
全角: ＡＢＣａｂｃ１２３（）［］｛｝！？
日文混合: ｶﾀｶﾅ カタカナ ひらがな 漢字，韩文: ﾊﾝｸﾞﾙ 한글`,
        },
        {
            title: '复杂专项-4（Emoji + ZWJ + 旗帜）',
            text: `Emoji: 😀😃😄😁😆😅😂🤣😊😇
ZWJ: 👨‍👩‍👧‍👦 👩‍💻 🧑‍🚀 🧑‍🔬 🧑‍🍳
Flags: 🇨🇳 🇺🇸 🇯🇵 🇰🇷 🇹🇭 🇸🇦 🇪🇸 🇷🇺 🇮🇹 🇫🇷`,
        },
        {
            title: '复杂专项-5（超长串/软断行）',
            text: `LongToken: SuperLongMixedToken中文English日本語한국어ไทยالعربيةEspañolРусскийItalianoFrançais1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ
SoftBreakHint: 中文\u200BEnglish\u200B日本語\u200B한국어\u200Bไทย\u200Bالعربية\u200BEspañol
URL-like: https://example.com/中文/path/العربية/日本語/very-long-segment-for-wrap-testing`,
        },
    ];

    protected onEnable(): void {
        this._captureBaseSize();
        this._ensureTestAreaSize();
        this._applyDebugLayout();
        this._ensureIcuLabel();
        this._ensurePauseButton();
        this._ensureReferenceSpriteNode();
        this._tryAutoLoadReferenceFrames();
        this.scheduleOnce(() => {
            if (this.referenceImageFrames.length === 0 && this._referenceFrameByCase.length === 0) {
                this._refLog('retry auto-load once after 1s');
                this._tryAutoLoadReferenceFrames();
            }
        }, 1);
        this._showCurrentCase();
        this._restartAutoPlay();
    }

    protected onDisable(): void {
        this.unschedule(this._showNextCase);
        if (this._pauseButtonNode) {
            this._pauseButtonNode.active = false;
        }
    }

    protected onDestroy(): void {
        if (this._pauseButtonNode?.isValid) {
            this._pauseButtonNode.off(Node.EventType.TOUCH_END, this._onPauseButtonPressed, this);
            this._pauseButtonNode.destroy();
        }
    }

    private _showNextCase = (): void => {
        if (this._cases.length === 0) {
            return;
        }

        this._currentIndex = (this._currentIndex + 1) % this._cases.length;
        this._showCurrentCase();
    };

    private _showCurrentCase(): void {
        const label = this.targetLabel ?? this.getComponent(Label);
        if (!label || this._cases.length === 0) {
            return;
        }

        this._prepareLabelForDisplay(label);

        const item = this._cases[this._currentIndex];
        const indexText = `${this._currentIndex + 1}/${this._cases.length}`;
        const displayText = `[${indexText}] ${item.title}\n${item.text}`;

        if (this.forceWrapText) {
            const icuLabel = this._ensureIcuLabel(label);
            if (icuLabel) {
                icuLabel.enabled = true;
                void icuLabel.setIcuText(displayText);
            } else {
                label.string = displayText;
            }
        } else {
            if (this._icuLabel) {
                this._icuLabel.enabled = false;
            }
            label.string = displayText;
        }

        this._updateDebugBorder(label);
        this._updateReferencePanel(item);
        this._logCurrentState(item);
    }

    private _captureBaseSize(): void {
        const label = this.targetLabel ?? this.getComponent(Label);
        const transform = label?.node.getComponent(UITransform);
        if (!label || !transform) {
            return;
        }

        this._baseSize = new Size(transform.contentSize.width, transform.contentSize.height);
        this._baseFontSize = label.fontSize;
        this._baseLineHeight = label.lineHeight;
    }

    private _prepareLabelForDisplay(label: Label): void {
        // 关键：先恢复基础字号/行高，避免 SHRINK 后续把字号“遗留”为超小值。
        if (this._baseFontSize > 0) {
            label.fontSize = this._baseFontSize;
        }
        if (this._baseLineHeight > 0) {
            label.lineHeight = this._baseLineHeight;
        }
        label.enableWrapText = !this.forceWrapText;

        label.overflow = Label.Overflow.RESIZE_HEIGHT;

        // 每个样例只测一次 ICU 预换行，因此统一使用固定宽度并让高度自适应。
        const transform = label.node.getComponent(UITransform);
        if (!transform || !this._baseSize) {
            return;
        }

        const width = this.useTestAreaSize ? this.testAreaWidth : this._baseSize.width;
        const height = this.useTestAreaSize ? this.testAreaHeight : this._baseSize.height;
        transform.setContentSize(width, height);
    }

    private _logCurrentState(item: CaseItem): void {
        if (!this.enableDebugLog) {
            return;
        }

        const label = this.targetLabel ?? this.getComponent(Label);
        const transform = label?.node.getComponent(UITransform);
        const sizeText = transform
            ? `${Math.round(transform.contentSize.width)}x${Math.round(transform.contentSize.height)}`
            : 'n/a';
        console.info(
            `[LanguageSortValidation] case="${item.title}" length=${item.text.length} size=${sizeText}`,
        );
    }

    private _ensureTestAreaSize(): void {
        if (!this.useTestAreaSize) {
            return;
        }

        const label = this.targetLabel ?? this.getComponent(Label);
        const transform = label?.node.getComponent(UITransform);
        if (!transform) {
            return;
        }

        transform.setContentSize(this.testAreaWidth, this.testAreaHeight);
    }

    private _ensureIcuLabel(label?: Label | null): ICULabel | null {
        const hostLabel = label ?? this.targetLabel ?? this.getComponent(Label);
        if (!hostLabel) {
            return null;
        }

        if (this._icuLabel?.node === hostLabel.node) {
            return this._icuLabel;
        }

        this._icuLabel = hostLabel.node.getComponent(ICULabel) ?? hostLabel.node.addComponent(ICULabel);
        return this._icuLabel;
    }

    private _ensurePauseButton(): void {
        const hostLabel = this.targetLabel ?? this.getComponent(Label);
        const hostParent = hostLabel?.node.parent ?? this.node.parent;
        if (!hostParent) {
            return;
        }

        if (!this._pauseButtonNode || !this._pauseButtonNode.isValid) {
            const buttonNode = new Node('PauseButton');
            buttonNode.parent = hostParent;
            buttonNode.layer = hostParent.layer;

            const transform = buttonNode.addComponent(UITransform);
            transform.setContentSize(108, 40);

            const widget = buttonNode.addComponent(Widget);
            widget.isAlignTop = true;
            widget.isAlignRight = true;
            widget.top = 20;
            widget.right = 20;
            widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

            buttonNode.on(Node.EventType.TOUCH_END, this._onPauseButtonPressed, this);

            this._pauseButtonNode = buttonNode;
        }

        const buttonNode = this._pauseButtonNode;
        const buttonTransform = buttonNode.getComponent(UITransform) ?? buttonNode.addComponent(UITransform);
        buttonTransform.setContentSize(108, 40);

        this._pauseButtonGraphics = buttonNode.getComponent(Graphics) ?? buttonNode.addComponent(Graphics);

        const legacyRootLabel = buttonNode.getComponent(Label);
        if (legacyRootLabel) {
            legacyRootLabel.enabled = false;
        }

        let textNode = buttonNode.getChildByName('PauseButtonText');
        if (!textNode) {
            textNode = new Node('PauseButtonText');
            textNode.parent = buttonNode;
        }
        textNode.layer = buttonNode.layer;

        const textTransform = textNode.getComponent(UITransform) ?? textNode.addComponent(UITransform);
        textTransform.setContentSize(buttonTransform.contentSize.width, buttonTransform.contentSize.height);

        const textWidget = textNode.getComponent(Widget) ?? textNode.addComponent(Widget);
        textWidget.isAlignLeft = true;
        textWidget.isAlignRight = true;
        textWidget.isAlignTop = true;
        textWidget.isAlignBottom = true;
        textWidget.left = 0;
        textWidget.right = 0;
        textWidget.top = 0;
        textWidget.bottom = 0;
        textWidget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        const label = textNode.getComponent(Label) ?? textNode.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'Arial';
        label.string = '暂停';
        label.fontSize = 20;
        label.lineHeight = 24;
        label.enableWrapText = false;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        this._pauseButtonLabel = label;

        this._pauseButtonNode.active = true;
        this._pauseButtonNode.getComponent(Widget)?.updateAlignment();
        textNode.getComponent(Widget)?.updateAlignment();
        this._refreshPauseButton();
    }

    private _onPauseButtonPressed(): void {
        this._isPaused = !this._isPaused;
        this._restartAutoPlay();
        this._refreshPauseButton();
    }

    private _restartAutoPlay(): void {
        this.unschedule(this._showNextCase);
        if (!this._isPaused) {
            this.schedule(this._showNextCase, this.intervalSeconds);
        }
    }

    private _refreshPauseButton(): void {
        if (this._pauseButtonLabel) {
            this._pauseButtonLabel.string = this._isPaused ? '继续' : '暂停';
            this._pauseButtonLabel.color = new Color(255, 255, 255, 255);
        }

        const graphics = this._pauseButtonGraphics;
        const node = this._pauseButtonNode;
        if (!graphics || !node) {
            return;
        }

        const transform = node.getComponent(UITransform);
        if (!transform) {
            return;
        }

        const width = transform.contentSize.width;
        const height = transform.contentSize.height;
        const startX = -width * transform.anchorX;
        const startY = -height * transform.anchorY;

        graphics.clear();
        graphics.fillColor = this._isPaused
            ? new Color(46, 125, 50, 220)
            : new Color(33, 33, 33, 220);
        graphics.strokeColor = new Color(255, 255, 255, 180);
        graphics.lineWidth = 2;
        graphics.roundRect(startX, startY, width, height, 10);
        graphics.fill();
        graphics.stroke();
    }

    private _updateReferencePanel(item: CaseItem): void {
        if (this.referenceInfoLabel) {
            const defaultRef = '参考站点: https://www.unicode.org/charts/  (可为当前用例配置专属截图)';
            this.referenceInfoLabel.string = item.reference ?? defaultRef;
        }

        if (!this.referenceImageSprite) {
            return;
        }

        let frame: SpriteFrame | null = null;
        if (this._referenceFrameByCase.length > this._currentIndex) {
            frame = this._referenceFrameByCase[this._currentIndex];
        }
        if (!frame) {
            frame = this.referenceImageFrames[this._currentIndex] ?? null;
        }
        this.referenceImageSprite.spriteFrame = frame;
        this.referenceImageSprite.node.active = !!frame;

        if (!frame && this.warnWhenReferenceMissing) {
            const need = this._cases.length;
            const loaded = this.referenceImageFrames.length;
            console.warn(
                `[LanguageSortValidation] missing reference image for case index=${this._currentIndex + 1}. loaded=${loaded}, totalCases=${need}`,
            );
        }
    }

    private _ensureReferenceSpriteNode(): void {
        if (this.referenceImageSprite) {
            return;
        }

        const label = this.targetLabel ?? this.getComponent(Label);
        if (!label) {
            return;
        }

        const host = label.node;
        const labelTransform = host.getComponent(UITransform);
        const refNode = new Node('ReferenceSprite');
        refNode.parent = host;

        const sprite = refNode.addComponent(Sprite);
        const transform = refNode.addComponent(UITransform);
        transform.setAnchorPoint(0.5, 1.0);

        const width = this.useTestAreaSize
            ? this.testAreaWidth
            : Math.round(labelTransform?.contentSize.width ?? 640);
        const height = Math.round(width * 0.4);
        transform.setContentSize(width, height);

        // 放在 Label 文字区域下方，便于同屏对照。
        const downOffset = this.useTestAreaSize
            ? this.testAreaHeight * 0.5 + 20
            : (labelTransform?.contentSize.height ?? 260) * 0.5 + 20;
        refNode.setPosition(new Vec3(0, -downOffset, 0));

        this.referenceImageSprite = sprite;
    }

    private _tryAutoLoadReferenceFrames(): void {
        if (!this.autoLoadReferenceFrames) {
            this._refLog('auto load disabled');
            return;
        }

        this._refLog(`loadDir start: resources/${this.referenceResourceDir}`);
        resources.loadDir(this.referenceResourceDir, SpriteFrame, (err, assets) => {
            if (err) {
                this._refLog(
                    `loadDir failed: dir=${this.referenceResourceDir}, err=${err.message}`,
                );
                return;
            }

            const sorted = [...assets].sort((a, b) => a.name.localeCompare(b.name));
            this._refLog(
                `loadDir done: count=${sorted.length}, names=[${sorted
                    .map((x) => x.name)
                    .join(', ')}]`,
            );
            if (sorted.length > 0) {
                this.referenceImageFrames = sorted;
                this._referenceFrameByCase = this._buildCaseFrameMapFromList(sorted);
                this._showCurrentCase();
                this._refLog(
                    `loaded ${sorted.length} reference images from resources/${this.referenceResourceDir}`,
                );
                if (sorted.length < this._cases.length) {
                    this._loadReferenceFramesByCaseName();
                }
            } else {
                this._loadReferenceFramesByCaseName();
            }
        });
    }

    private _buildCaseFrameMapFromList(list: SpriteFrame[]): Array<SpriteFrame | null> {
        const map: Array<SpriteFrame | null> = new Array(this._cases.length).fill(null);
        for (let i = 0; i < this._cases.length && i < list.length; i++) {
            map[i] = list[i];
        }
        return map;
    }

    private _loadReferenceFramesByCaseName(): void {
        const total = this._cases.length;
        if (total <= 0) {
            return;
        }

        const mapped: Array<SpriteFrame | null> = new Array(total).fill(null);
        let pending = total;

        for (let i = 0; i < total; i++) {
            const num = i + 1;
            const caseName = `case-${num < 10 ? `0${num}` : `${num}`}`;
            const basePath = `${this.referenceResourceDir}/${caseName}`;
            this._loadSpriteFrameByPath(basePath, (frame) => {
                mapped[i] = frame;
                pending--;
                if (pending === 0) {
                    this._referenceFrameByCase = mapped;
                    this.referenceImageFrames = mapped.filter((f): f is SpriteFrame => !!f);
                    this._showCurrentCase();
                    const loaded = this.referenceImageFrames.length;
                    this._refLog(`mapped by case name: loaded=${loaded}, totalCases=${total}`);
                }
            });
        }
    }

    private _loadSpriteFrameByPath(path: string, done: (frame: SpriteFrame | null) => void): void {
        resources.load(path, SpriteFrame, (err, asset) => {
            if (!err && asset) {
                this._refLog(`hit: ${path}`);
                done(asset);
                return;
            }
            this._refLog(`miss: ${path} (${err ? err.message : 'unknown'})`);

            resources.load(`${path}/spriteFrame`, SpriteFrame, (fallbackErr, fallbackAsset) => {
                if (!fallbackErr && fallbackAsset) {
                    this._refLog(`hit fallback: ${path}/spriteFrame`);
                    done(fallbackAsset);
                    return;
                }
                this._refLog(
                    `miss fallback: ${path}/spriteFrame (${fallbackErr ? fallbackErr.message : 'unknown'})`,
                );

                // 兼容 Texture2D 资源：动态包一层 SpriteFrame，避免必须手改导入类型。
                resources.load(path, Texture2D, (texErr, tex) => {
                    if (!texErr && tex) {
                        const sf = new SpriteFrame();
                        sf.texture = tex;
                        this._refLog(`hit texture and wrapped: ${path}`);
                        done(sf);
                        return;
                    }
                    this._refLog(
                        `miss texture: ${path} (${texErr ? texErr.message : 'unknown'})`,
                    );
                    done(null);
                });
            });
        });
    }

    private _refLog(msg: string): void {
        if (!this.verboseReferenceLog) {
            return;
        }
        console.info(`[LanguageSortValidation][Ref] ${msg}`);
    }

    private _applyDebugLayout(): void {
        if (!this.debugAutoCenterLabel) {
            return;
        }

        const label = this.targetLabel ?? this.getComponent(Label);
        if (!label) {
            return;
        }

        const node = label.node;
        const transform = node.getComponent(UITransform);
        if (transform) {
            transform.anchorX = 0.5;
            transform.anchorY = 0.5;
        }

        if (this.debugDisableWidgetWhenCentering) {
            const widget = node.getComponent(Widget);
            if (widget) {
                widget.enabled = false;
            }
        }

        node.setPosition(new Vec3(0, 0, 0));
    }

    private _updateDebugBorder(label: Label): void {
        const node = label.node;
        let graphics = node.getComponent(Graphics);

        if (!this.debugShowBorder) {
            if (graphics) {
                graphics.clear();
            }
            return;
        }

        if (!graphics) {
            graphics = node.addComponent(Graphics);
        }

        const transform = node.getComponent(UITransform);
        if (!transform) {
            return;
        }

        const width = transform.contentSize.width;
        const height = transform.contentSize.height;
        const startX = -width * transform.anchorX;
        const startY = -height * transform.anchorY;

        graphics.clear();
        graphics.lineWidth = 2;
        graphics.strokeColor = new Color(64, 220, 255, 180);
        graphics.rect(startX, startY, width, height);
        graphics.stroke();
    }
}
