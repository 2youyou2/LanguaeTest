import { _decorator, Component, game, Label, UITransform } from "cc";
import { wrapRtlTextToString } from "./rtl-visual-wrap";
import { EDITOR, NATIVE } from "cc/env";
import { view } from "cc";


const { ccclass, property, executeInEditMode } = _decorator

type MeasureContext = {
    font: string;
    measureText(text: string): { width: number };
};

let measureCache = new Map<string, number>()
let _ctx: MeasureContext | null = null

function getMeasureContext() {
    if (_ctx) {
        return _ctx;
    }

    const gameCanvas = game.canvas as any;
    _ctx = gameCanvas?.getContext?.('2d') || null;

    if (_ctx) {
        return _ctx;
    }

    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        _ctx = document.createElement('canvas').getContext('2d');
    }

    if (_ctx) {
        return _ctx;
    }

    const runtime = globalThis as typeof globalThis & { OffscreenCanvas?: any };
    if (typeof runtime.OffscreenCanvas === 'function') {
        _ctx = new runtime.OffscreenCanvas(1, 1).getContext('2d');
    }

    return _ctx;
}

function estimateTextWidth(text: string, desc?: string) {
    const fontSizeMatch = desc?.match(/(\d+(?:\.\d+)?)px/);
    const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 16;
    return text.length * fontSize * 0.62;
}

function getLabelFontFamily(label: Label) {
    let _fontFamily = '';
    if (!label.useSystemFont) {
        if (label.font) {
            _fontFamily = label.font._nativeAsset || 'Arial';
        } else {
            _fontFamily = 'Arial';
        }
    } else {
        _fontFamily = label.fontFamily || 'Arial';
    }
    return _fontFamily;
}


function getLabelFontDescriptor(label: Label) {
    const customFont = (label as any).font;
    const fontFamily = getLabelFontFamily(label);
    const fontStyle = (label as any).isItalic ? 'italic ' : '';
    const fontWeight = (label as any).isBold ? 'bold ' : '';

    let actualSize = label.fontSize * view.getScaleX();
    return `${fontStyle}${fontWeight}${actualSize}px ${fontFamily}`;
}


function safeMeasureText(string: string, desc?: string): number {
    const ctx = getMeasureContext();
    if (!ctx) {
        return estimateTextWidth(string, desc);
    }

    const font = desc || ctx.font;
    ctx.font = font;
    const key = `${font}\uD83C\uDFAE${string}`;
    const cache = measureCache.get(key);
    if (typeof cache === 'number') {
        return cache;
    }

    const metric = ctx.measureText(string);
    const width = metric && metric.width || 0;
    measureCache.set(key, width);

    return width;
}

@ccclass('ICULabel')
@executeInEditMode
export class ICULabel extends Component {
    private _updateVersion = 0

    @property
    _str = ''

    @property
    get str() {
        return this._str
    }
    set str(v) {
        this._str = v
        this.dirty = true
    }

    uiTransform: UITransform | undefined
    currentWidth = 0

    dirty = true

    protected onEnable(): void {
        this.updateLabel()
    }

    async updateLabel() {
        if (!EDITOR && !NATIVE) {
            return
        }

        const updateVersion = ++this._updateVersion
        try {
            const label = this.getComponent(Label);
            if (!label) {
                return;
            }

            const t = label.getComponent(UITransform)
            if (!t) {
                return;
            }

            this.uiTransform = t
            this.currentWidth = t.width

            const fontDesc = getLabelFontDescriptor(label);
            const str = await wrapRtlTextToString(this._str, {
                maxWidth: t.width * view.getScaleX(),
                measureWidth: (s) => safeMeasureText(s, fontDesc)
            });

            if (updateVersion !== this._updateVersion) {
                return;
            }

            label.string = str
        } catch (error) {
            console.error('[ICULabel] Failed to update RTL text.', error)
        }

        if (EDITOR) {
            cce.Engine.repaintInEditMode()
        }

        this.dirty = false
    }

    update() {
        if (!this.uiTransform) {
            return
        }

        if (this.uiTransform.width !== this.currentWidth || this.dirty) {
            this.updateLabel()
        }
    }
}
