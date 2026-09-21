import type { common as englishCommon } from "../en/common";

export const common = {
  "locale.label": "语言",
  "locale.en": "英语",
  "locale.zh-CN": "简体中文",
  "appearance.label": "外观",
  "appearance.light": "浅色",
  "appearance.dark": "深色",
  "appearance.system": "跟随系统",
  "common.help": "帮助",
  "common.cancel": "取消",
  "common.close": "关闭",
  "common.copy": "复制",
  "common.download": "下载",
  "common.forget": "忘记",
  "common.unavailable": "不可用",
  "common.select": "请选择…",
} as const satisfies Record<keyof typeof englishCommon, string>;
