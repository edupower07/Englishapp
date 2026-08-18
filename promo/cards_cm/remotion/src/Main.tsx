import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { C, CUTS, F, K, V, s } from "./theme";
import { cl, easeBack, easeInOut, easeOut, lerp, pulse } from "./lib";
import { CardWall, Chip, Flash, Highlight, Shot, TapRing, Telop } from "./parts";
import { Fonts } from "./Fonts";
import { Soundtrack } from "./Soundtrack";
import man from "../public/manifest.json";

const SAMPLE =
  "絵カード枚ぜんぶ無料小学校外国語アプリポータルライブラリをひらく検索保存曜日" +
  "まとめてダウンロードワークシートスライドづくり教育目的自由学校授業でそのまま使える" +
  "トップを下までスクロール英語でけんさくタップ右クリック長押しヒット一括" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./@①②③④";

/** スクショ内の座標(CSSピクセル) */
const M = man as unknown as {
  portal_h: number;
  portal_btn: { x: number; y: number; w: number; h: number };
  lib_search: { x: number; y: number; w: number; h: number };
  lib_zip: { x: number; y: number; w: number; h: number };
  lib_tap_card: { x: number; y: number; w: number; h: number };
  hook_cards: string[];
  search_term: string;
  tap_card: string;
};

const PORTAL_MAX = M.portal_h - 720; // ポータルの最下部までのスクロール量
const BTN = {
  cx: M.portal_btn.x + M.portal_btn.w / 2,
  cy: M.portal_btn.y + M.portal_btn.h / 2 - PORTAL_MAX,
};
/** library_pre.png / library_search.png を撮ったスクロール位置(両方そろえてある) */
const LIB_SCROLL = (man as { lib_scroll_pre?: number }).lib_scroll_pre ?? 104;
const SEARCH = {
  x: M.lib_search.x,
  y: M.lib_search.y - LIB_SCROLL,
  w: M.lib_search.w,
  h: M.lib_search.h,
};
const ZIP = M.lib_zip;
const TAP = M.lib_tap_card;

const useSec = () => useCurrentFrame() / V.fps;

/* =================================================================== *
 * 0.0–3.2  フック : 絵カードが降ってきて敷き詰まる
 * =================================================================== */
const Hook: React.FC = () => {
  const t = useSec();
  const impact = 1.32;
  const k = cl(1 - (t - impact) / 0.55); // 着地の余韻
  const shake = t > impact ? k * k : 0;
  const dim = lerp(0, 0.66, easeOut(cl((t - impact) / 0.4)));

  const l1 = pulse(t, impact + 0.06, 3.2, 0.22, 0.01);
  const l2 = pulse(t, impact + 0.16, 3.2, 0.26, 0.01);
  const l3 = pulse(t, impact + 0.5, 3.2, 0.24, 0.01);

  return (
    <AbsoluteFill style={{ background: C.purple, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `translate(${Math.sin(t * 95) * 26 * shake}px, ${
            Math.cos(t * 78) * 19 * shake
          }px)`,
        }}
      >
        <CardWall files={M.hook_cards} t={t} />
        <AbsoluteFill style={{ background: C.deep, opacity: dim }} />
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            fontFamily: F.display.family,
            fontWeight: 800,
            fontSize: 52,
            color: "#fff",
            opacity: l1,
            letterSpacing: "0.14em",
            transform: `translateY(${lerp(30, 0, easeOut(l1))}px)`,
            textShadow: "0 4px 20px rgba(0,0,0,.5)",
          }}
        >
          小学校の外国語
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            opacity: l2,
            transform: `scale(${lerp(0.84, 1, easeBack(l2))})`,
            marginTop: 8,
          }}
        >
          <span
            style={{
              fontFamily: F.display.family,
              fontWeight: 800,
              fontSize: 132,
              color: "#fff",
              textShadow: "0 10px 30px rgba(0,0,0,.45)",
            }}
          >
            絵カード
          </span>
          <span
            style={{
              fontFamily: F.display.family,
              fontWeight: 800,
              fontSize: 188,
              color: C.yellow,
              textShadow: "0 10px 30px rgba(0,0,0,.45)",
            }}
          >
            862
          </span>
          <span
            style={{
              fontFamily: F.display.family,
              fontWeight: 800,
              fontSize: 108,
              color: "#fff",
              textShadow: "0 10px 30px rgba(0,0,0,.45)",
            }}
          >
            枚
          </span>
        </div>
        <div
          style={{
            marginTop: 22,
            background: C.teal,
            color: "#fff",
            fontFamily: F.display.family,
            fontWeight: 800,
            fontSize: 62,
            padding: "12px 46px",
            borderRadius: 999,
            opacity: l3,
            transform: `scale(${lerp(0.8, 1, easeBack(l3))})`,
            boxShadow: "0 12px 30px rgba(0,0,0,.3)",
          }}
        >
          ぜんぶ、無料でもらえます
        </div>
      </AbsoluteFill>

      <Flash v={t > impact ? (1 - (t - impact) / 0.42) * 0.95 : 0} />
    </AbsoluteFill>
  );
};

/* =================================================================== *
 * 3.2–6.4  ポータルの全景
 * =================================================================== */
const Portal: React.FC = () => {
  const t = useSec();
  const zoom = lerp(1.06, 1, easeOut(cl(t / 0.7)));
  return (
    <AbsoluteFill>
      <Shot src="shots/portal_full.png" scrollCss={0} zoom={zoom} originCss={{ x: 640, y: 300 }} />
      <Telop
        t={t}
        from={0.25}
        to={3.2}
        main="ぜんぶ、このポータルの中にあります"
        sub="小学校外国語アプリポータル"
        accent={C.purple}
      />
      <Flash v={(1 - t / 0.16) * 0.55} />
    </AbsoluteFill>
  );
};

/* =================================================================== *
 * 6.4–10.4  手順① トップを下までスクロール → ライブラリをひらく
 * =================================================================== */
const Step1: React.FC = () => {
  const t = useSec();
  // 0.35→1.5秒で一気に最下部まで送る(速い区間だけ軽くぼかす)
  const p = easeInOut(cl((t - 0.35) / 1.15));
  const scroll = lerp(0, PORTAL_MAX, p);
  const speed = Math.abs(p - easeInOut(cl((t - 0.35 - 1 / V.fps) / 1.15)));
  const blur = cl(speed * 90) * 7;
  const zoom = lerp(1, 1.62, easeOut(cl((t - 1.9) / 0.95)));

  return (
    <AbsoluteFill>
      <Shot
        src="shots/portal_full.png"
        scrollCss={scroll}
        zoom={zoom}
        originCss={{ x: BTN.cx, y: BTN.cy }}
        blurPx={blur}
      >
        <Highlight
          xCss={M.portal_btn.x}
          yCss={M.portal_btn.y - PORTAL_MAX}
          wCss={M.portal_btn.w}
          hCss={M.portal_btn.h}
          t={t - 2.1}
          color={C.red}
        />
        <TapRing xCss={BTN.cx} yCss={BTN.cy} t={t - 2.75} />
      </Shot>
      <Telop t={t} from={0.1} to={2.0} badge="①" main="トップページを下までスクロール" />
      <Telop
        t={t}
        from={2.15}
        to={4.0}
        badge="①"
        main="「ライブラリをひらく」をタップ"
        accent={C.red}
      />
    </AbsoluteFill>
  );
};

/* =================================================================== *
 * 10.4–14.2  手順② 絵カードライブラリがひらく
 * =================================================================== */
const Step2: React.FC = () => {
  const t = useSec();
  const scroll = lerp(40, 980, easeInOut(cl((t - 0.3) / 3.2)));
  const n = Math.round(lerp(0, 862, easeOut(cl((t - 0.3) / 1.5))));
  return (
    <AbsoluteFill>
      <Shot src="shots/library_full.png" scrollCss={scroll} />
      <Chip t={t} from={0.3} to={3.8} text={`${n} 枚`} bg={C.purpleDeep} />
      <Telop
        t={t}
        from={0.15}
        to={3.8}
        badge="②"
        main="絵カードが、ずらり"
        sub="Picture Dictionary で使っている絵カードぜんぶ"
        accent={C.purple}
      />
      <Flash v={(1 - t / 0.14) * 0.6} />
    </AbsoluteFill>
  );
};

/* =================================================================== *
 * 14.2–18.6  手順③ 英語でけんさく
 * =================================================================== */
const TypeBox: React.FC<{ t: number; text: string }> = ({ t, text }) => {
  const shown = text.slice(0, Math.max(0, Math.floor((t - 0.5) / 0.26) + 1));
  const caret = Math.floor(t * 2.4) % 2 === 0;
  return (
    <div
      style={{
        position: "absolute",
        left: (SEARCH.x + 3) * K,
        top: (SEARCH.y + 3) * K,
        width: (SEARCH.w - 6) * K,
        height: (SEARCH.h - 6) * K,
        background: "#fff",
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        paddingLeft: 20 * K,
        boxSizing: "border-box",
      }}
    >
      <span
        style={{
          fontFamily: F.display.family,
          fontWeight: 800,
          fontSize: 16 * K,
          color: C.ink,
          letterSpacing: "0.02em",
        }}
      >
        {shown}
      </span>
      {t > 0.25 && caret && (
        <span
          style={{
            display: "inline-block",
            width: 3 * K,
            height: 22 * K,
            background: C.ink,
            marginLeft: 3 * K,
          }}
        />
      )}
    </div>
  );
};

const Step3: React.FC = () => {
  const t = useSec();
  const typed = 0.5 + 0.26 * M.search_term.length + 0.25; // 打ち終わる時刻
  const done = t >= typed;
  return (
    <AbsoluteFill>
      {done ? (
        <Shot src="shots/library_search.png" />
      ) : (
        <Shot src="shots/library_pre.png">
          <TypeBox t={t} text={M.search_term} />
        </Shot>
      )}
      {done && <Flash v={(1 - (t - typed) / 0.18) * 0.5} />}
      <Chip t={t} from={typed + 0.15} to={4.4} text="12枚 ヒット" bg={C.teal} />
      <Telop t={t} from={0.12} to={typed} badge="③" main="英語でけんさくできる" />
      <Telop
        t={t}
        from={typed + 0.15}
        to={4.4}
        badge="③"
        main="曜日カードが、ぜんぶ出た"
        sub="ワークシートづくりがはかどります"
        accent={C.teal}
      />
    </AbsoluteFill>
  );
};

/* =================================================================== *
 * 18.6–23.0  手順④ タップ → 右クリックで保存
 * =================================================================== */
const ContextMenu: React.FC<{ t: number }> = ({ t }) => {
  const p = easeBack(cl(t / 0.34));
  if (t < 0) return null;
  const rows = ["画像を新しいタブで開く", "画像をコピー", "名前を付けて画像を保存…"];
  const hot = t > 0.75;
  return (
    <div
      style={{
        position: "absolute",
        left: 1055,
        top: 470,
        width: 470,
        background: "#fff",
        borderRadius: 18,
        padding: "14px 0",
        boxShadow: "0 22px 50px rgba(0,0,0,.38)",
        transform: `scale(${lerp(0.8, 1, p)})`,
        transformOrigin: "0% 0%",
        opacity: cl(p),
      }}
    >
      {rows.map((r, i) => {
        const on = hot && i === 2;
        return (
          <div
            key={i}
            style={{
              padding: "16px 30px",
              fontFamily: F.display.family,
              fontWeight: on ? 800 : 700,
              fontSize: 32,
              color: on ? "#fff" : i === 2 ? C.ink : "#9aa3ad",
              background: on ? C.purpleDeep : "transparent",
            }}
          >
            {r}
          </div>
        );
      })}
    </div>
  );
};

const Step4: React.FC = () => {
  const t = useSec();
  const open = 0.95;
  const p = easeOut(cl((t - open) / 0.45));
  const cx = lerp((TAP.x + TAP.w / 2) * K, V.width / 2, p);
  const cy = lerp((TAP.y + TAP.h / 2) * K, V.height / 2, p);
  const sc = lerp((TAP.w * K) / V.width, 1, p);
  const saved = t > 2.75;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Shot src="shots/library_search.png" dim={p * 0.45}>
        <TapRing xCss={TAP.x + TAP.w / 2} yCss={TAP.y + TAP.h / 2} t={t - 0.2} />
      </Shot>

      {t >= open && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: V.width,
            height: V.height,
            transform: `translate(${cx - V.width / 2}px, ${cy - V.height / 2}px) scale(${sc})`,
            transformOrigin: "50% 50%",
            borderRadius: lerp(30, 0, p),
            overflow: "hidden",
            background: "#000",
            boxShadow: "0 30px 80px rgba(0,0,0,.5)",
          }}
        >
          {/* 下のテロップ帯に "Monday" の文字が隠れないよう、開ききってから少し上げる
              (元画像は上下が黒帯なので、下に空く分はそのまま黒でつながる) */}
          <Img
            src={staticFile("shots/card_big.png")}
            style={{
              position: "absolute",
              left: 0,
              top: -112 * p,
              width: V.width,
              display: "block",
            }}
          />
        </div>
      )}

      <ContextMenu t={t - 1.75} />

      {saved && (
        <div
          style={{
            // ブラウザのダウンロード通知と同じく右上に出す(絵と文字の重なりも避けられる)
            position: "absolute",
            right: 54,
            top: 54,
            transform: `scale(${lerp(0.75, 1, easeBack(cl((t - 2.75) / 0.4)))})`,
            transformOrigin: "100% 0%",
            background: "#fff",
            borderRadius: 999,
            padding: "18px 44px",
            display: "flex",
            alignItems: "center",
            gap: 18,
            boxShadow: "0 16px 40px rgba(0,0,0,.35)",
            fontFamily: F.display.family,
            fontWeight: 800,
            fontSize: 42,
            color: C.ink,
          }}
        >
          <span style={{ color: C.teal, fontSize: 46 }}>✓</span>
          {M.tap_card}.jpg を保存しました
        </div>
      )}

      <Telop t={t} from={0.12} to={1.15} badge="④" main="カードをタップすると大きく開く" />
      <Telop
        t={t}
        from={1.55}
        to={4.4}
        badge="④"
        main="右クリック(長押し)で保存"
        accent={C.purpleDeep}
      />
    </AbsoluteFill>
  );
};

/* =================================================================== *
 * 23.0–26.4  まとめてほしいなら ZIP 一括ダウンロード
 * =================================================================== */
const Zip: React.FC = () => {
  const t = useSec();
  const zoom = lerp(1, 1.42, easeOut(cl(t / 1.0)));
  const cxCss = ZIP.x + ZIP.w / 2;
  const cyCss = ZIP.y + ZIP.h / 2;
  return (
    <AbsoluteFill>
      <Shot src="shots/library_full.png" scrollCss={0} zoom={zoom} originCss={{ x: cxCss, y: cyCss }}>
        <Highlight
          xCss={ZIP.x}
          yCss={ZIP.y}
          wCss={ZIP.w}
          hCss={ZIP.h}
          t={t - 0.55}
          color={C.red}
          padCss={5}
        />
        <TapRing xCss={cxCss} yCss={cyCss} t={t - 1.15} />
      </Shot>
      <Chip t={t} from={1.6} to={3.4} text="862枚 まるごと" bg={C.red} />
      <Telop
        t={t}
        from={0.15}
        to={3.4}
        main="まとめてなら、ZIPで一括ダウンロード"
        sub="画像は images フォルダに入っています"
        accent={C.red}
      />
      <Flash v={(1 - t / 0.14) * 0.6} />
    </AbsoluteFill>
  );
};

/* =================================================================== *
 * 26.4–30.0  締め
 * =================================================================== */
const Close: React.FC = () => {
  const t = useSec();
  const a = pulse(t, 0.15, 3.6, 0.3, 0.01);
  const b = pulse(t, 0.55, 3.6, 0.3, 0.01);
  const c = pulse(t, 1.0, 3.6, 0.3, 0.01);
  return (
    <AbsoluteFill style={{ background: C.deep }}>
      <CardWall files={M.hook_cards} t={0} fall={false} blurPx={8} />
      <AbsoluteFill style={{ background: C.deep, opacity: 0.84 }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            fontFamily: F.display.family,
            fontWeight: 800,
            fontSize: 86,
            color: "#fff",
            opacity: a,
            transform: `translateY(${lerp(30, 0, easeOut(a))}px)`,
            textAlign: "center",
          }}
        >
          ワークシートにも、スライドにも。
        </div>
        <div
          style={{
            marginTop: 30,
            background: "#fff",
            color: C.purpleDeep,
            fontFamily: F.latin.family,
            fontSize: 58,
            padding: "16px 52px",
            borderRadius: 999,
            opacity: b,
            transform: `scale(${lerp(0.85, 1, easeBack(b))})`,
            boxShadow: "0 14px 36px rgba(0,0,0,.35)",
          }}
        >
          edupower07.github.io/Englishapp
        </div>
        <div
          style={{
            marginTop: 34,
            fontFamily: F.display.family,
            fontWeight: 700,
            fontSize: 40,
            color: "#ffffffcc",
            opacity: c,
            textAlign: "center",
            lineHeight: 1.7,
          }}
        >
          学校・自治体の教育目的での利用は自由です(申請不要)
          <br />
          小学校外国語アプリポータル ／ X: @Edupower07
        </div>
      </AbsoluteFill>
      <Flash v={(1 - t / 0.16) * 0.7} />
    </AbsoluteFill>
  );
};

/* =================================================================== */

const cut = (name: keyof typeof CUTS) => {
  const [a, b] = CUTS[name];
  return { from: s(a), durationInFrames: s(b) - s(a) };
};

export const Main: React.FC = () => (
  <Fonts fonts={F} sampleText={SAMPLE}>
    <AbsoluteFill style={{ background: C.bg }}>
      <Sequence {...cut("hook")}>
        <Hook />
      </Sequence>
      <Sequence {...cut("portal")}>
        <Portal />
      </Sequence>
      <Sequence {...cut("step1")}>
        <Step1 />
      </Sequence>
      <Sequence {...cut("step2")}>
        <Step2 />
      </Sequence>
      <Sequence {...cut("step3")}>
        <Step3 />
      </Sequence>
      <Sequence {...cut("step4")}>
        <Step4 />
      </Sequence>
      <Sequence {...cut("zip")}>
        <Zip />
      </Sequence>
      <Sequence {...cut("close")}>
        <Close />
      </Sequence>
      <Soundtrack bgmSrc="audio/bgm.mp3" fps={V.fps} />
    </AbsoluteFill>
  </Fonts>
);
