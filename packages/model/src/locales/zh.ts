import type { LocaleData } from "../locale-data.ts";

/** Chinese (Simplified): fetched with the language (locale-data.ts). */
const data: LocaleData = {
  periods: {
    periods: {
      eb1: "早期青铜时代 I",
      eb2: "早期青铜时代 II",
      eb3: "早期青铜时代 III",
      eb4: "早期青铜时代 IV",
      mb2: "中期青铜时代 II",
      lb: "晚期青铜时代",
      iron1: "铁器时代 I",
      iron2a: "铁器时代 IIA",
      iron2b: "铁器时代 IIB",
      iron2c: "铁器时代 IIC",
      babylonian: "巴比伦时期",
      persian: "波斯时期",
      hellenistic: "希腊化时期",
      hasmonean: "哈斯蒙尼时期",
      "early-roman": "早期罗马时期",
      roman: "罗马时期",
      "late-roman": "晚期罗马时期",
      byzantine: "拜占庭时期",
      "early-islamic": "早期伊斯兰时期",
      crusader: "十字军时期",
      mamluk: "马穆鲁克时期",
    },
    disputed: {
      mb2: "族长时代的年代存在争议",
      lb: "出埃及：约公元前1446年或约前1270年",
      iron2a: "考古学家对其年代存在争议",
    },
    ages: {
      eb1: "早期青铜",
      mb2: "中期青铜",
      lb: "晚期青铜",
      iron1: "铁器时代",
      babylonian: "巴比伦",
      persian: "波斯",
      hellenistic: "希腊化",
      "early-roman": "罗马",
      byzantine: "拜占庭",
      "early-islamic": "中世纪",
    },
  },
  site: {
    same: (x) => `与${x}同地`,
    sameName: (x) => `与其他经文中的${x}同地`,
    within: (x, n, u) => `${x}，半径${n}${u}内`,
    around: (x, n, u) => `${x}，半径约${n}${u}内`,
    region: (x) => `${x}一带`,
    along: (x) => `沿：${x}`,
    km: "公里",
    m: "米",
  },
};

export default data;
