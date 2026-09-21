# Protocol Box

Protocol Box packages an experimental procedure and its guided use into a portable document whose authorship and integrity can be checked.

## Language

**Protocol**:
A complete experimental procedure published by an Author for Readers to follow.
_Chinese_: 实验规程; use 规程 where space is constrained
_Avoid_: Document, workflow, experiment

**Author**:
The person or organization that defines and signs a Protocol.
_Chinese_: 作者
_Avoid_: Editor, creator, owner

**Author Key**:
A signing key associated with an Author whose Author Key ID can be checked through a Trusted Distribution Channel.
_Chinese_: 作者密钥
_Avoid_: Password, account, certificate

**Author Key ID**:
A deterministic identifier of an Author Key's public key that people can compare through a Trusted Distribution Channel; it does not establish the Author's real-world identity.
_Chinese_: 作者密钥 ID
_Avoid_: Author identity, certificate, Author Key fingerprint

**Key Bundle**:
An encrypted, portable file through which an Author retains custody of an Author Key.
_Chinese_: 密钥包
_Avoid_: Keychain, wallet, private-key backup

**Key Bundle Password**:
A secret used only to encrypt and decrypt a Key Bundle; it is not an Author Key, account credential, identity proof, or recovery code.
_Chinese_: 密钥包密码
_Avoid_: Author Key password, account password, recovery password, passphrase

**Browser Key Bundle Recovery Copy**:
An encrypted copy of a Key Bundle retained by one browser so an Author can recover or reopen that Key Bundle locally; it does not replace an externally saved Key Bundle.
_Chinese_: 浏览器密钥包恢复副本
_Avoid_: Backup, local path, remembered password

**Trusted Distribution Channel**:
A channel independently chosen by its users to obtain or compare an expected Author Key ID, Protocol Fingerprint, or whole-file SHA-256; Protocol Box does not determine whether the channel is trustworthy.
_Chinese_: 可信分发渠道
_Avoid_: Protocol Box verification, trusted identity provider, certificate authority

**Reader**:
A person who configures and follows a Protocol without changing its signed definition.
_Chinese_: 阅读者
_Avoid_: User, operator, participant

**Section**:
An ordered unit of a Protocol that the Reader follows as one playback step.
_Chinese_: 规程步骤; use 步骤 where space is constrained
_Avoid_: Page, chapter, stage

**Task Item Completion Requirement**:
An Author-declared Section rule requiring every checklist Task Item in that Section to be checked before the Section can complete.
_Chinese_: 清单完成要求
_Avoid_: Checklist gate, continue lock, mandatory checkbox

**Variable Definition**:
An Author-declared, typed input accepted by a Protocol, including its default and constraints.
_Chinese_: 变量定义
_Avoid_: Parameter, field, placeholder

**Input Variable**:
A Variable Definition whose value is supplied by the Reader before a Playback Session begins.
_Chinese_: 输入变量
_Avoid_: Base variable, user variable

**Derived Variable**:
A Variable Definition whose value is calculated from Input Variables or other Derived Variables by an Author-defined formula.
_Chinese_: 派生变量
_Avoid_: Formula variable, output variable, calculated field

**Variable Value**:
A resolved value for an Input Variable or Derived Variable during a Playback Session.
_Chinese_: 变量值
_Avoid_: Configuration, setting

**Playback Session**:
A browser-local, non-evidentiary record of one Reader's resumable progress through a Protocol, including Variable Values and timing state.
_Chinese_: 导引会话
_Avoid_: Run, execution, reading

**Completion Summary**:
An unsigned, non-evidentiary view of a completed Playback Session for printing or personal reference.
_Chinese_: 完成摘要
_Avoid_: Experiment record, audit log, certificate

**Unsigned Draft**:
An editable Protocol definition kept encrypted in browser storage that has not been signed in its current form.
_Chinese_: 未签名草稿
_Avoid_: Internal modification, working copy

**Author Preview**:
A non-evidentiary simulation in which an Author checks an Unsigned Draft using transient Variable Values and Playback behavior without creating a Playback Session or Completion Summary.
_Chinese_: 作者预览
_Avoid_: Playback Session, test run, draft execution

**Formula Test Case**:
An Author-defined set of Input Values and expected Derived Values used to detect changes in formula behavior.
_Chinese_: 公式测试用例
_Avoid_: Example, sample data, experiment result

**Signature Match**:
The state in which a Protocol's current content matches the signature of its embedded Author Key; it does not independently establish the Author's identity.
_Chinese_: 签名匹配
_Avoid_: Trusted Author, verified identity, valid document

**Signature Mismatch**:
The state in which a Protocol's current content does not match its attached Author signature.
_Chinese_: 签名不匹配
_Avoid_: Unknown Author, corrupted file

**Playable Protocol**:
A Protocol whose format, resource bounds, formulas, and content pass all checks required for Playback.
_Chinese_: 可导引规程
_Avoid_: Signature Match, trusted Protocol

**Protocol Fingerprint**:
A short, human-comparable representation of the complete Protocol content used to distinguish one published version from another.
_Chinese_: 规程指纹
_Avoid_: File hash, version number

**Published Protocol**:
An immutable, signed Protocol HTML distributed by an Author with its whole-file SHA-256.
_Chinese_: 已发布规程
_Avoid_: Original file, clean export, template

**Fork**:
A new Protocol derived from an existing Protocol but given a new Protocol identity.
_Chinese_: 派生副本
_Avoid_: Revision, copy, new version
