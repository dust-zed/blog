+++
date = '2025-11-02T10:14:30+08:00'
draft = false
title = 'Http协议深度解析'

+++

### HTTP协议深度解析

深入地讲解HTTP协议的核心知识。

#### 一、HTTP基础架构

##### 1.1 HTTP的本质

HTTP是一个无状态的应用层协议，基于**请求-响应**模型：

* 客户端发起请求
* 服务器返回响应
* 每次请求都是独立的，服务器不保留之前的状态

##### 1.2 传输层基础

HTTP建立在TCP之上：

* HTTP/1.0和1.1: 使用TCP
* HTTP/2: 使用TCP（但优化了多路复用）
* HTTP/3:使用QUIC（基于UDP）

#### 二、 HTTP请求结构

##### 2.1 请求组成

```
请求行 (Request Line)
请求头 (Headers)
空行
请求体 (Body, 可选)
```

示例：

```http
GET /api/users?page=1 HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0
Accept: application/json
Content-Type: application/json
Cookie: session_id=abc123

{"filter": "active"}
```

##### 2.2 请求方法深入

**GET**

* 获取资源，幂等且安全
* 参数在URL中，有长度限制
* 可被缓存、书签保存

**POST**

* 创建资源或提交数据
* 参数在请求体中，无长度限制
* 不可缓存（除非显式指定）

**PUT**

* 完整更新资源，幂等
* 多次执行结果相同

**PATCH**

* 部分更新资源
* 只更新指定字段

**DELETE**

* 删除资源，幂等

**HEAD**

* 只获取响应头，不返回响应体
* 用于检查资源是否存在、获取元信息

**OPTIONS**

* 查询服务器支持的方法
* CORS预检请求使用

##### 2.3 关键请求头

**Host**：必需，指定目标主机

```http
Host: www.example.com:8080
```

**User-Agent**：客户端信息

```http
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)
```

**Accept系列**：内容协商

```http
Accept: text/html,application/json
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Accept-Encoding: gzip, deflate, br
```

**Authoriation**：认证信息

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Cookie**：会话标识

```http
Cookie: session_id=abc123; user_pref=dark_mode
```

#### 三、 HTTP响应结构

##### 3.1 响应组成

```
状态行 (Status Line)
响应头 (Headers)
空行
响应体 (Body)
```

示例：

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 348
Cache-Control: max-age=3600
Set-Cookie: session_id=xyz789; HttpOnly; Secure

{"status": "success", "data": {...}}
```

##### 3.2 状态码深度解析

**1xx**信息性响应

* `100 Continue`：客户端继续发送请求体
* `101 Switching Protocols`：切换协议（如WebSocket）

**2xx**成功

* `200 OK`：请求成功
* `201 Created`：资源已创建
* `204 No Content`： 成功但无响应体
* `206 Partial Content`：范围请求成功

**3xx**重定向

* `301 Moved Permanently`：永久重定向，会改变后续请求方法为GET
* `302 Found`：临时重定向
* `303 See Other`：使用GET方法重定向
* `304 Not Modified`：资源未修改，使用缓存
* `307 Temporary Redirect`：临时重定向，保持请求方法
* `308 Permanent Redirect`：永久重定向，保持请求方法

**4xx**客户端错误

* `400 Bad Request`：请求语法错误
* `401 Unathorized`：需要认证
* `403 Fobidden`：拒绝访问
* `404 Not Found`：资源不存在
* `405 Method Not Allowed`：方法不允许
* `409 Conflict`：请求冲突
* `429 Too Many Requests`：请求过多

**5xx**服务器错误

* `500 Internal Server Error`：服务器内部错误
* `502 Bad Gateway`：网关错误
* `503 Service Unavailable`：服务不可用
* `504 Gateway Timeout`：网关超时

##### 3.3 关键响应头

**Content-Type**：响应体类型

```http
Content-Type: application/json; charset=utf-8
Content-Type: text/html; charset=utf-8
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary
```

**Set-Cookie**：设置Cookie

```http
Set-Cookie: session_id=abc123; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600
```

**Cache-Control**：缓存策略

```http
Cache-Control: no-cache, no-store, must-revalidate
Cache-Control: public, max-age=31536000
```

####  四、HTTP连接管理

##### 4.1 持久连接(Keep-Alive)

HTTP/1.0: 默认短连接

```http
Connection: Keep-Alive
```

HTTP/1.1: 默认持久连接

```http
Connection: close  # 明确关闭
```

**优势**：

- 减少 TCP 握手开销
- 降低延迟
- 减轻服务器负担

##### 4.2 管道化（Pipelining）

- HTTP/1.1 支持但很少用
- 可以连续发送多个请求，无需等待响应
- 存在队头阻塞问题

##### 4.3 HTTP/2 多路复用

```
单个 TCP 连接
  ├─ Stream 1: /index.html
  ├─ Stream 2: /style.css
  ├─ Stream 3: /script.js
  └─ Stream 4: /api/data
```

**特性:**

- 二进制分帧
- 请求/响应并行
- 服务器推送
- 头部压缩(HPACK)

#### 五、缓存机制深入

##### 5.1 强缓存

**Expires**(HTTP/1.0)

```http
Expires: Wed, 21 Oct 2025 07:28:00 GMT
```

**Cache-Control**(HTTP/1.1,优先级更高)

```http
Cache-Control: max-age=3600
Cache-Control: public, max-age=31536000, immutable
```

指令详解：

- `public`: 可被任何缓存存储
- `private`：只能被浏览器缓存
- `no-cache`：必须验证后才能使用
- `no-store`：不得缓存
- `max-age=N`：缓存N秒
- `s-maxage=N`: 代理服务器缓存N秒
- `immutable`：资源永不改变

##### 5.2 协商缓存

**Last-Modified/ If-Modified-Since**

```http
# 首次响应
Last-Modified: Wed, 21 Oct 2024 07:28:00 GMT

# 再次请求
If-Modified-Since: Wed, 21 Oct 2024 07:28:00 GMT

# 未修改返回
HTTP/1.1 304 Not Modified
```

**ETag/ If-None-Match**(更精确)

```http
# 首次响应
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"

# 再次请求
If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"

# 未修改返回
HTTP/1.1 304 Not Modified
```

##### 5.3 缓存策略

强缓存优先策略：

```http
Cache-Control: public, max-age=31536000, immutable
```

协商缓存策略：

```http
Cache-Control: no-cache
ETag: "version-123"
```

不缓存策略：

```http
Cache-Control: no-store, no-cache, must-revalidate
Pragma: no-cache
```

#### 六、安全相关

##### 6.1 HTTPS原理

**TLS/SSL**握手过程：

1. 客户端发送支持的加密套件
2. 服务器选择加密套件，发送证书
3. 客户端验证证书，生成预主密钥
4. 双方协商会话密钥
5. 使用对称加密通信

**对称加密 + 非对称加密混合：**

- 非对称加密交换密钥（慢但安全）
- 对称加密传输数据（快）

##### 6.2 Cookie安全

```http
Set-Cookie: session=abc; 
  HttpOnly;        # 防止 XSS 攻击
  Secure;          # 只通过 HTTPS 传输
  SameSite=Strict; # 防止 CSRF 攻击
  Domain=.example.com;
  Path=/;
  Max-Age=3600
```

**SameSite**属性:

- Strict: 完全禁止跨站发送
- Lax：GET请求可跨站发送
- None：允许跨站（需配合Secure）

##### 6.3 安全响应头

```http
# 防止点击劫持
X-Frame-Options: DENY

# 内容类型嗅探保护
X-Content-Type-Options: nosniff

# XSS 保护
X-XSS-Protection: 1; mode=block

# 内容安全策略
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'

# HTTPS 强制
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

#### 七、性能优化

##### 7.1 内容编码

```http
# 请求支持的编码
Accept-Encoding: gzip, deflate, br

# 响应使用的编码
Content-Encoding: gzip
```

压缩率对比：

- gzip: 70-90%
- Brotli(br): 75-95%(更优)

##### 7.2 范围请求（断点续传）

```http
# 请求部分内容
Range: bytes=0-1023

# 响应
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1023/10240
Content-Length: 1024
```

##### 7.3 条件请求

```http
# 只在资源未修改时更新
If-Unmodified-Since: Wed, 21 Oct 2024 07:28:00 GMT
If-Match: "etag-value"
```

#### 八、CORS跨域

##### 8.1 简单请求

满足条件：

- 方法：GET，HEAD，POST
- 头部：Accept, Accept-Language, Content-Language, Content-Type
- Content-Type: text/plain, multipart/form-data, application/x-www-form-urlencoded

```http
# 请求
Origin: https://example.com

# 响应
Access-Control-Allow-Origin: https://example.com
Access-Control-Allow-Credentials: true
```

##### 8.2 预检请求

复杂请求需要先发送OPTIONS：

```http
# 预检请求
OPTIONS /api/data HTTP/1.1
Origin: https://example.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: Content-Type, X-Custom-Header

# 预检响应
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, X-Custom-Header
Access-Control-Max-Age: 86400
```

#### 九、HTTP/3 与QUIC

##### 9.1 核心改进

- **基于UDP**：避免TCP队头阻塞
- **0-RTT**：首次连接后，后续连接无需握手
- **连接迁移**：IP变化不影响连接
- **内置加密**：强制 TLS 1.3

##### 9.2 性能对比

```
HTTP/1.1: 多个 TCP 连接,队头阻塞
HTTP/2:   单个 TCP 连接,TCP 层队头阻塞
HTTP/3:   QUIC,无队头阻塞,连接迁移
```

#### 十、实践建议

##### 10.1 API 设计

- 使用合适的 HTTP 方法
- 返回正确的状态码
- 设计清晰的 URL 结构
- 实现幂等性

##### 10.2 性能优化

- 启用 HTTP/2 或 HTTP/3
- 使用 CDN 和缓存策略
- 压缩响应内容
- 减少请求数量

##### 10.3 安全措施

- 使用 HTTPS
- 设置安全响应头
- 实现速率限制
- 验证输入数据

------

#### 层次协作

```
应用层: HTTP 定义内容和格式
         ↓
       "GET /index.html HTTP/1.1\r\nHost: example.com\r\n\r\n"
         ↓
传输层: TCP 负责可靠传输
         ↓
       [分段] → [加序列号] → [确认机制] → [重传机制]
         ↓
网络层: IP 负责寻址和路由
         ↓
       [添加 IP 地址] → [选择路径]
         ↓
链路层: 以太网/WiFi 负责实际传输
         ↓
       [转换成电信号/无线信号]
```

**TCP** 是传输管道(负责怎么送),**HTTP** 是管道里的内容规范(规定送什么和什么格式)

#### OSI七层模型 vs TCP/IP四层模型

```
OSI 七层模型          TCP/IP 四层模型        实际协议示例
┌─────────────┐      ┌─────────────┐
│ 7. 应用层    │      │             │      HTTP, FTP, SMTP, DNS
├─────────────┤      │             │      
│ 6. 表示层    │      │  应用层      │      SSL/TLS, JPEG, MPEG
├─────────────┤      │             │      
│ 5. 会话层    │      │             │      NetBIOS, RPC
├─────────────┤      ├─────────────┤
│ 4. 传输层    │      │  传输层      │      TCP, UDP
├─────────────┤      ├─────────────┤
│ 3. 网络层    │      │  网络层      │      IP, ICMP, ARP
├─────────────┤      ├─────────────┤
│ 2. 数据链路层│      │             │      Ethernet, WiFi, PPP
├─────────────┤      │  链路层      │      
│ 1. 物理层    │      │             │      网线, 光纤, 无线电波
└─────────────┘      └─────────────┘
```

**说明**：OSI 是理论模型，TCP/IP 是实际应用的模型
