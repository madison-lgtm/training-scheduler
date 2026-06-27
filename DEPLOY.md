# 发布步骤

这份说明用于把本地 demo 变成教练和学员都能访问的线上版本。

## 你需要做的部分

### 1. 创建 Firebase 项目

1. 打开 https://console.firebase.google.com/
2. 点击 `Create a project` / `Add project`
3. 项目名可以填 `training-scheduler`
4. Google Analytics 可以先关掉
5. 点击创建项目

### 2. 添加 Web App

1. 进入 Firebase 项目首页
2. 点击 Web 图标 `</>`
3. App nickname 可以填 `training-scheduler-web`
4. 不需要勾选 Firebase Hosting
5. 点击注册
6. 复制页面里显示的 `firebaseConfig`

### 3. 开启 Firestore

1. 左侧进入 `Build` -> `Firestore Database`
2. 点击创建数据库
3. 先选择 test mode
4. Location 选择离你们近的区域即可
5. 创建完成后，先去 `Authentication` -> `Sign-in method`，打开 `Anonymous` 登录。
6. 回到 Firestore 的 `Rules`，正式试用时用下面规则：

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /training-scheduler/main {
      allow read, write: if request.auth != null;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

这会把数据库限制在 `training-scheduler/main` 这个 app 文件里，并要求访问者先由网页匿名登录。
它适合小范围正式试用；如果以后要严格区分 Dora 和学员，需要再加正式登录或后端权限。

## 我可以帮你做的部分

### 4. 填 Firebase 配置

把你复制到的 `firebaseConfig` 发给我，或者自己打开 `firebase-config.js`，把里面的占位值换成真实值，并把：

```js
enabled: false
```

改成：

```js
enabled: true
```

### 5. 发布到 GitHub Pages

1. 在 GitHub 创建一个新 repository
2. 上传 `training-scheduler-app` 文件夹里的文件
3. 进入 repository 的 `Settings`
4. 打开 `Pages`
5. Source 选择 `Deploy from a branch`
6. Branch 选择 `main`
7. Folder 选择 `/root`
8. 保存
9. 等 1 到 3 分钟，GitHub 会生成一个 `github.io` 链接

## 发布后测试

1. 用手机打开 GitHub Pages 链接
2. 提交一个学员申请
3. 在电脑打开同一个链接
4. 输入教练 PIN
5. 确认能看到刚才手机提交的数据
6. 生成草案并发布
7. 回到学员页输入名字，确认能看到自己的安排

## 注意

当前版本是朋友小范围 MVP。Firestore test mode 和前端 PIN 都不是严格安全方案。等真的给更多学员使用时，应该升级成正式权限规则或登录系统。
