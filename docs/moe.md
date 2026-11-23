# Taiwan MOE Data Source

The Taiwan Ministry of Education's 國字標準字體筆順學習網 (<https://stroke-order.learningweb.moe.edu.tw/>) teaches the standard forms (標準字體) and stroke order of about 4,800 common traditional characters. [g0v/zh-stroke-data](https://github.com/g0v/zh-stroke-data) scraped its stroke XML in 2017 and converted it to JSON. `MoeProvider` reads that JSON.

## Terms

The data is © the Ministry of Education, for non-commercial educational use. g0v's README says the XML files fall outside the Ministry's licence and were taken under article 50 of Taiwan's copyright act (reproduction of works published by government agencies, within reasonable scope). Kaku bundles none of it and has no default URL: host your own copy and decide whether the terms suit your use.

## Coverage

4,847 files: the 常用 standard set (4,808) and a few more. Compared with AnimCJK's traditional set, the stroke counts agree once repeated strokes are dropped, apart from 徹, where the MOE data is consistent with its own 育 and AnimCJK is not.

The forms are Taiwan's: 艹 is 4 strokes, 辶 4, 阝 3, and the top of 充, 育 and 流 is written without a separate dot (充 is 5 strokes). Unihan's `kTotalStrokes` often follows the mainland count and is no check on this data.

## File Format

One file per character, named by **lowercase hex** codepoint: `52fb.json` for 勻 (U+52FB). Each file is an array of strokes in drawing order:

```json
[
  {
    "outline": [
      { "type": "M", "x": 752, "y": 611 },
      { "type": "Q", "begin": { "x": 727, "y": 639 }, "end": { "x": 703, "y": 665 } },
      { "type": "L", "x": 993, "y": 975 },
      { "type": "C", "begin": { "x": 684, "y": 1051 }, "mid": { "x": 804, "y": 987 }, "end": { "x": 810, "y": 1099 } }
    ],
    "track": [{ "x": 915, "y": 215 }, { "x": 785, "y": 440, "size": 40 }]
  }
]
```

- **Grid:** 2150 × 2150, y pointing down.
- **outline:** the stroke's filled shape. `M` and `L` carry `x`/`y`; `Q` carries `begin` (control point) and `end`; `C` carries `begin`, `mid` (control points) and `end`. Every outline starts with `M`; a few have a second `M` (subpaths). The path is closed.
- **track:** the centre line in drawing direction, at least two points. Some points carry a `size` (brush width), unused here.

## Conversion

`MoeProvider` scales everything by 1024/2150 to AnimCJK's viewBox, so `AnimCJKRenderer` and its stroke width (128) apply unchanged:

- `strokes[i].pathData` is the track as a polyline (`M x y L x y …`); KakuRen scores against it.
- `rawSvg` has AnimCJK's layout: an outline path per stroke (`id="moe{cp}d{n}"`), a `clipPath` per outline, and a direction path per stroke clipped to its outline with `style="--d:{n}s;"`. IDs use a `moe` prefix so the same character from AnimCJK (`z{cp}…`) can share a page.

## Known Faults

The scraped data repeats a stroke in 13 characters (30 strokes): 回 寓 寞 年 慰 懂 榻 漫 瞞 薄 藐 蝨 製; 懂 is there twice over. A stroke is a repeat when its track starts and ends within 130 grid units (about 6% of the box) of an earlier stroke's and their outlines' bounding boxes overlap by more than 60% (intersection over union). That catches all 30 and nothing else in the set. `dropDuplicates: false` keeps them.

Three tracks run on past the stroke's end and jump back to an earlier point (刃 stroke 2, 妒 6, 刈 4), so the stroke seems to end near its start and KakuRen would reject correct drawings as backwards. `MoeProvider` cuts a track at a segment longer than 40% of its span that lands within 12% of an earlier point; that touches exactly these three, and hooks, which turn back only a little, are left alone. This is not optional.

Compared with AnimCJK's traditional set stroke by stroke (1,565 characters with equal counts), only 藉 stroke 5 runs the other way, and that is the Taiwan form: 耒 starts with a falling stroke where AnimCJK has the mainland horizontal. The 33 strokes that sit elsewhere are stroke-order differences (來, 感, 房, 皮…), where the MOE data is the standard.

The Ministry's site has since moved its data (`provideStrokeInfo.do?ucs=<hex>` replaced the `big5=` form that g0v used), and the 2017 scrape is not refreshed.
