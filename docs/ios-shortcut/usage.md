# 3. iOS 快捷指令使用说明

### 1. 截屏：获取屏幕内容

### 2. 请求输入：请求用户提问

### 3. 获取URL内容：

 JSON 方式（`Content‑Type: application/json`）

```json
{
  "provider": "provider-a",
  "model": "default-model",
  "text": "${请求输入}",
  "image":"${截屏}"
}
```

 表单方式（`multipart/form-data`）

|字段|类型|含义|
|--|--|--|
|`image`|文件（png/jpeg）|步骤 1 获取的截图|
|`text`|文本|用户在步骤 2 的提问|
|`provider`|文本|`provider-a`/`provider-b`，必传|
|`model`|文本|必传|
|`stream`|文本 `true/false`|是否流式返回 (可省略，默认true)|

### 4.获取词典值：键路径 choices.0.message.content
