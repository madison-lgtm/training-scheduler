# Dora Training 发布说明

当前目录就是 GitHub Pages 发布仓库：

```txt
github-training-scheduler/
```

远程仓库：

```txt
https://github.com/madison-lgtm/training-scheduler.git
```

线上网址：

```txt
https://madison-lgtm.github.io/training-scheduler/
```

## 当前状态

本地已经有最新版本，并且已经 commit。因为当前 Codex 环境暂时解析不到 `github.com`，所以最后一步 push 可能会失败。

检查状态：

```bash
cd /Users/tchen273/Documents/Codex/2026-06-19/5-track-track-schedule-6-7/github-training-scheduler
git status
```

如果看到类似：

```txt
Your branch is ahead of 'origin/main' by 1 commit.
```

说明本地已经准备好，只差推送。

## 手动上线

在网络正常、GitHub 登录状态正常的电脑终端里运行：

```bash
cd /Users/tchen273/Documents/Codex/2026-06-19/5-track-track-schedule-6-7/github-training-scheduler
git push
```

推送成功后，GitHub Pages 通常 1 到 3 分钟内更新。

## 上线后测试

1. 手机打开 `https://madison-lgtm.github.io/training-scheduler/`。
2. 进入 `Member 入口`，输入名字和识别码。
3. 设置默认安排，提交一个选中周申请。
4. 进入 `Dora 工作台`，输入 Dora PIN。
5. 点 `操作` -> `生成草案`。
6. 手机端测试点学员名字，再点目标时间格，确认可以移动。
7. 点 `发布最终安排`。
8. 回到 Member 页，输入同一个名字和识别码，确认能看到自己的课。

## Firebase / 数据同步

`firebase-config.js` 已经配置为启用 Firebase 时读取云端同一份数据。没有开启或连接失败时，网页会进入本地演示模式，只保存在当前浏览器里。

## 安全提醒

这个版本适合 Dora 和少量会员小范围使用。Dora PIN 是轻量入口保护，不是正式账号系统。后续如果会员变多，建议加正式登录和后端权限。
