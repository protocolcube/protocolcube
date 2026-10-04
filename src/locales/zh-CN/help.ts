import type { help as englishHelp } from "../en/help";

export const help = {
  "help.title": "Protocol Box 帮助",
  "help.subtitle": "用于编写、检查和遵循便携实验规程的离线指南。",
  "help.backWorkbench": "返回工作台",
  "help.backTopics": "返回帮助主题",
  "help.chooseTopic": "选择主题",
  "help.learn.authorKey": "了解作者密钥",
  "help.learn.drafts": "了解草稿",
  "help.learn.sections": "了解规程步骤",
  "help.learn.variables": "了解变量",
  "help.learn.formulas": "公式帮助",
  "help.learn.preview": "了解作者预览",
  "help.learn.publish": "发布帮助",
  "help.topic.author": "作者指南",
  "help.topic.author.summary": "完整作者工作流的详细说明。",
  "help.topic.reader": "阅读者快速入门",
  "help.topic.reader.summary": "检查已发布规程并遵循其步骤。",
  "help.topic.glossary": "术语表",
  "help.topic.glossary.summary": "一致使用 Protocol Box 领域术语。",
  "help.topic.security": "安全与证据",
  "help.topic.security.summary": "了解签名、本地存储和证据限制。",
  "help.topic.keyboard": "键盘与窗格控制",
  "help.topic.keyboard.summary": "无需指针设备也能高效导航工作台。",
  "help.topic.troubleshooting": "故障排除",
  "help.topic.troubleshooting.summary": "解决导引受阻、存储和浏览器能力问题。",
  "help.author.intro":
    "作者定义并签署完整的实验规程。请通过加密密钥包保管作者密钥。",
  "help.author.step1.title": "解锁作者模式",
  "help.author.step1.body": "创建密钥包，或使用密码打开现有加密密钥包。",
  "help.author.step2.title": "创建或打开未签名草稿",
  "help.author.step2.body":
    "未签名草稿会加密保存在浏览器存储中，并可在发布前继续编辑。",
  "help.author.step3.title": "定义实验规程",
  "help.author.step3.body":
    "添加有序步骤、变量定义、公式以及所需的公式测试用例。",
  "help.author.step4.title": "保存并预览",
  "help.author.step4.body":
    "保存未签名草稿，然后使用作者预览检查临时变量值和导引行为。",
  "help.author.step5.title": "发布",
  "help.author.step5.body":
    "解决可导引规程检查问题，签署实验规程，并保存自包含 HTML 及其整文件 SHA-256。",
  "help.reader.intro":
    "阅读者配置并遵循实验规程，但不会更改其已签名定义。",
  "help.reader.step1.title": "检查签名框架",
  "help.reader.step1.body":
    "开始前确认格式有效、签名匹配且为可导引规程。",
  "help.reader.step2.title": "设置变量值",
  "help.reader.step2.body":
    "填写每个输入变量，并在导引前检查派生变量结果。",
  "help.reader.step3.title": "选择会话存储",
  "help.reader.step3.body":
    "敏感变量值应使用内存。持久导引会话只是明文便利数据。",
  "help.reader.step4.title": "遵循当前步骤",
  "help.reader.step4.body":
    "使用步骤侧栏或抽屉，遵守计时器，并确认每次步骤更改。",
  "help.reader.step5.title": "谨慎使用完成摘要",
  "help.reader.step5.body":
    "完成摘要未签名且不具证据效力，仅用于打印或个人参考。",
  "help.glossary.intro": "这些名称属于文件格式和产品契约的一部分。",
  "help.glossary.protocol.term": "实验规程",
  "help.glossary.protocol.definition": "作者发布、供阅读者遵循的完整实验程序。",
  "help.glossary.author.term": "作者",
  "help.glossary.author.definition": "定义并签署实验规程的个人或组织。",
  "help.glossary.reader.term": "阅读者",
  "help.glossary.reader.definition":
    "配置并遵循实验规程、但不更改其已签名定义的人。",
  "help.glossary.authorKey.term": "作者密钥",
  "help.glossary.authorKey.definition":
    "与作者关联的签名密钥，其作者密钥 ID 可通过可信分发渠道核对。",
  "help.glossary.authorKeyId.term": "作者密钥 ID",
  "help.glossary.authorKeyId.definition":
    "作者密钥公钥的确定性标识，可通过可信分发渠道进行人工比较；它不能确认作者的现实身份。",
  "help.glossary.keyBundle.term": "密钥包",
  "help.glossary.keyBundle.definition":
    "作者用于保管作者密钥的加密便携文件。",
  "help.glossary.keyBundlePassword.term": "密钥包密码",
  "help.glossary.keyBundlePassword.definition":
    "仅用于加密和解密密钥包的秘密；它不是作者密钥、账户凭据、身份证明或恢复码。",
  "help.glossary.recoveryCopy.term": "浏览器密钥包恢复副本",
  "help.glossary.recoveryCopy.definition":
    "一个浏览器为了本地恢复或重新打开而保留的加密密钥包副本；它不能替代受保护的外部密钥包副本。",
  "help.glossary.trustedChannel.term": "可信分发渠道",
  "help.glossary.trustedChannel.definition":
    "用户独立选择、用于取得或核对预期作者密钥 ID、规程指纹或整文件 SHA-256 的渠道。Protocol Box 不判断该渠道是否可信。",
  "help.glossary.section.term": "规程步骤",
  "help.glossary.section.definition":
    "实验规程中有序的单元，阅读者将其作为一个导引步骤遵循。",
  "help.glossary.variableDefinition.term": "变量定义",
  "help.glossary.variableDefinition.definition":
    "作者声明的有类型输入，包括默认值和约束。",
  "help.glossary.inputVariable.term": "输入变量",
  "help.glossary.inputVariable.definition":
    "在导引会话开始前由阅读者提供变量值的变量定义。",
  "help.glossary.derivedVariable.term": "派生变量",
  "help.glossary.derivedVariable.definition":
    "通过作者定义的公式从输入变量或其他派生变量计算变量值的变量定义。",
  "help.glossary.durationVariable.term": "时长变量",
  "help.glossary.durationVariable.definition":
    "值表示时间长度的变量定义，按时长单位输入和呈现，并以规范化秒计算。",
  "help.glossary.durationUnit.term": "时长单位",
  "help.glossary.durationUnit.definition":
    "作者声明用于输入和呈现时长变量值的时间单位——秒、分钟、小时或天。",
  "help.glossary.variableValue.term": "变量值",
  "help.glossary.variableValue.definition":
    "导引会话期间输入变量或派生变量的已解析值。",
  "help.glossary.playbackSession.term": "导引会话",
  "help.glossary.playbackSession.definition":
    "浏览器本地、不具证据效力的可恢复进度记录，包括变量值和计时状态。",
  "help.glossary.completionSummary.term": "完成摘要",
  "help.glossary.completionSummary.definition":
    "已完成导引会话的未签名、不具证据效力视图，用于打印或个人参考。",
  "help.glossary.unsignedDraft.term": "未签名草稿",
  "help.glossary.unsignedDraft.definition":
    "加密保存在浏览器存储中的可编辑实验规程定义，其当前形式尚未签名。",
  "help.glossary.authorPreview.term": "作者预览",
  "help.glossary.authorPreview.definition":
    "作者使用临时变量值和导引行为检查未签名草稿的不具证据效力模拟，不会创建导引会话或完成摘要。",
  "help.glossary.formulaTest.term": "公式测试用例",
  "help.glossary.formulaTest.definition":
    "作者定义的一组输入值和预期派生值，用于检测公式行为变化。",
  "help.glossary.signatureMatch.term": "签名匹配",
  "help.glossary.signatureMatch.definition":
    "实验规程当前内容与其嵌入作者密钥的签名匹配；这并不能独立确认作者身份。",
  "help.glossary.signatureMismatch.term": "签名不匹配",
  "help.glossary.signatureMismatch.definition":
    "实验规程当前内容与附带的作者签名不匹配。",
  "help.glossary.playable.term": "可导引规程",
  "help.glossary.playable.definition":
    "格式、资源限制、公式和内容通过全部导引要求检查的实验规程。",
  "help.glossary.fingerprint.term": "规程指纹",
  "help.glossary.fingerprint.definition":
    "完整实验规程内容的简短、便于人工比较的表示，用于区分不同发布版本。",
  "help.glossary.published.term": "已发布规程",
  "help.glossary.published.definition":
    "作者分发的不可变、已签名实验规程 HTML，附带整文件 SHA-256。",
  "help.glossary.fork.term": "派生副本",
  "help.glossary.fork.definition":
    "从现有实验规程派生、但具有新规程身份的新实验规程。",
  "help.security.intro":
    "Protocol Box 将密钥保管、签名内容完整性、现实身份、本地存储和证据明确区分。每个边界需要不同的检查。",
  "help.security.warning.title": "依赖文件前必须了解这些限制",
  "help.security.warning.loss":
    "如果所有受保护的外部密钥包副本都丢失，或忘记了密钥包密码，Protocol Box 无法重建原作者密钥。",
  "help.security.warning.identity":
    "签名匹配只检查当前内容与同一文件中嵌入的公钥是否匹配，不能确认作者的现实身份。",
  "help.security.warning.evidence":
    "持久导引会话是明文便利数据，完成摘要未签名且不具证据效力。",
  "help.security.custody.title": "作者保管责任",
  "help.security.custody.description":
    "保护便携密钥包、密钥包密码以及每个已解锁浏览器会话。",
  "help.security.custody.password":
    "使用长且唯一的密钥包密码，并将其独立妥善保存。创建表单接受一个密码，并不表示该密码足够安全。",
  "help.security.custody.recovery":
    "浏览器可以为每个作者密钥 ID 保留一个已经验证的浏览器密钥包恢复副本。它只是可能消失的浏览器本地便利数据，绝不能替代受保护的外部密钥包副本。",
  "help.security.custody.lock":
    "锁定会保存当前草稿，并移除 Protocol Box 对内存中作者密钥和草稿解密材料的引用。它不会删除加密草稿或恢复副本，也不承诺安全擦除浏览器进程内存。",
  "help.security.custody.endpoint":
    "静态加密无法保护已解锁会话免受被控制设备、受损浏览器、恶意扩展、截屏或剪贴板访问。",
  "help.security.custody.revocation":
    "Protocol Box 不提供作者密钥撤销列表、证书链、账户恢复或自动密钥轮换。新密钥包会产生新的作者密钥 ID；旧已发布规程仍按原嵌入公钥验证。",
  "help.security.custody.compromise":
    "如果作者密钥可能泄露，应停止使用它，创建新密钥包，并通过可信分发渠道公布新的作者密钥 ID。Protocol Box 无法远程撤销旧文件。",
  "help.security.verification.title": "阅读者核验",
  "help.security.verification.description":
    "信任签名内容前，先确定自己预期的是哪个密钥和哪个文件。",
  "help.security.verification.signature":
    "签名匹配只证明当前已签名规程与同一个已发布规程中嵌入的作者密钥匹配。",
  "help.security.verification.replacement":
    "攻击者可以替换规程、嵌入另一个公钥并为替代内容签名；对于这个替代密钥，签名匹配仍然会成功。",
  "help.security.verification.channel":
    "请通过独立于已发布规程的可信分发渠道核对预期作者密钥 ID。Protocol Box 不判断你选择的渠道是否可信。",
  "help.security.localData.title": "本地数据",
  "help.security.localData.description":
    "根据数据的敏感程度和恢复价值选择存储方式。",
  "help.security.localData.drafts":
    "未签名草稿及其恢复快照以加密形式保存在浏览器存储中，只有匹配作者密钥解锁时才能派生所需密钥。",
  "help.security.localData.playback":
    "持久导引会话会将变量值和计时状态作为明文便利数据保存。敏感变量值应使用仅内存导引。",
  "help.security.localData.deletion":
    "删除草稿或恢复副本以及清除浏览器数据只是请求删除记录，不承诺从底层设备进行取证级安全擦除。",
  "help.security.evidence.title": "证据与网络边界",
  "help.security.evidence.description":
    "离线运行和可见摘要不会把本地状态变成可信证据。",
  "help.security.evidence.summary":
    "完成摘要未签名且不具证据效力，不是审计日志、证书、证明声明或工作确已发生的证据。",
  "help.security.evidence.network":
    "应用程序和已发布规程文件不会自动发起运行时网络请求。作者明确确认“下载并嵌入”时，会联网获取一次远程图片。",
  "help.security.evidence.links":
    "打开外部链接会离开离线已发布规程，并可能发起网络请求，因此必须由阅读者确认。",
  "help.security.identifiers.title": "核对正确的标识",
  "help.security.identifiers.intro":
    "这些标识回答不同的比较问题。任何一个都不能独立证明人的身份或实验已经执行。",
  "help.security.identifiers.name": "标识",
  "help.security.identifiers.identifies": "标识对象",
  "help.security.identifiers.changes": "何时变化",
  "help.security.identifiers.limitation": "不能证明什么",
  "help.security.identifiers.authorKey.name": "作者密钥 ID",
  "help.security.identifiers.authorKey.identifies": "与作者密钥关联的公钥。",
  "help.security.identifiers.authorKey.changes": "使用另一个作者密钥时。",
  "help.security.identifiers.authorKey.limitation":
    "不能确认作者的现实身份，也不能撤销其他密钥。",
  "help.security.identifiers.protocol.name": "规程指纹",
  "help.security.identifiers.protocol.identifies": "完整的规范化规程内容。",
  "help.security.identifiers.protocol.changes": "任何规范化规程内容变化时。",
  "help.security.identifiers.protocol.limitation":
    "不能标识外围 HTML 字节，也不能证明是谁分发了文件。",
  "help.security.identifiers.file.name": "整文件 SHA-256",
  "help.security.identifiers.file.identifies": "一个已分发规程 HTML 文件的精确字节。",
  "help.security.identifiers.file.changes": "完整 HTML 文件中的任何字节变化时。",
  "help.security.identifiers.file.limitation":
    "不能确认作者身份、内容含义或完成情况。",
  "help.security.crypto.title": "当前密码学格式详情",
  "help.security.crypto.intro":
    "以下内容描述密钥包格式版本 1 和当前未签名草稿存储格式；未来格式版本可能采用不同参数。",
  "help.security.crypto.bundle":
    "密钥包密码通过带随机盐且至少 600,000 次迭代的 PBKDF2-HMAC-SHA-256 处理，并根据设备向上校准。所得密钥使用 AES-GCM 保护经过认证的私钥密文。",
  "help.security.crypto.drafts":
    "解锁期间，Protocol Box 使用 HKDF-SHA-256 为每个未签名草稿派生独立密钥，并使用 AES-GCM 认证加密保护每个草稿版本。",
  "help.security.crypto.limit":
    "这些机制会增加离线猜测成本并检测密文修改，但不能让弱密码变强，也不能保护已经受损的解锁端点。",
  "help.security.related.title": "相关指南",
  "help.security.related.authorKey": "作者密钥与访问",
  "help.security.related.drafts": "未签名草稿",
  "help.security.related.publish": "发布与恢复",
  "help.security.related.glossary": "术语表",
  "help.security.related.security": "安全与证据",
  "help.keyboard.intro":
    "清晰可见的焦点、可预测的 Tab 顺序和明确对话框属于工作台契约。",
  "help.keyboard.general":
    "使用 Tab 和 Shift+Tab 在控件间移动。Escape 会关闭可取消的对话框，并将焦点恢复到打开控件。",
  "help.keyboard.help": "在作者模式的非文本输入区域按 ? 可打开键盘帮助。",
  "help.keyboard.save": "按 Ctrl+S 或 Command+S 保存当前未签名草稿。",
  "help.keyboard.preview":
    "按 Ctrl+Shift+Enter 或 Command+Shift+Enter 打开作者预览。",
  "help.keyboard.panes":
    "按 B 切换规程大纲，按 I 切换检查器。聚焦窗格分隔条后使用方向键调整大小。",
  "help.keyboard.reader":
    "阅读者导引时，宽屏使用步骤侧栏，窄屏使用步骤抽屉。每次跳转步骤都需要确认。",
  "help.keyboard.required": "必须确认的对话框不能用 Escape 关闭。",
  "help.troubleshooting.intro":
    "重试操作前，请先查看持久状态栏和完整性详情。",
  "help.troubleshooting.blocked":
    "若导引受阻，请检查格式、签名和可导引规程错误。不得绕过签名不匹配。",
  "help.troubleshooting.crypto":
    "若 Web Crypto 不可用，请在启用本地文件加密能力的当前 Chromium 浏览器中打开文件。",
  "help.troubleshooting.storage":
    "若浏览器存储不可用，请使用仅内存导引会话；关闭页面后进度不会保留。",
  "help.troubleshooting.timer":
    "若页面隐藏或检测到计时延迟后导引暂停，请查看原因并明确继续。",
  "help.troubleshooting.session":
    "若已存导引会话被隔离，请清除后重新配置当前已发布规程。",
  "help.troubleshooting.author":
    "若作者模式被禁用，请在打开草稿前检查 IndexedDB、Web Crypto 和文件打开能力消息。",} as const satisfies Record<keyof typeof englishHelp, string>;
