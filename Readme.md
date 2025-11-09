# ⚡ AuroraDNS

**AuroraDNS** is a lightweight, TypeScript-based DNS resolver built entirely from scratch.  
It implements the core mechanics of the DNS protocol — including **header parsing**,  
**question & answer decoding**, **name compression handling**, **TTL-aware caching**,  
and **multi-upstream failover** for reliability.

AuroraDNS can act as a **local forwarding resolver**, caching results by `(name|type|class)`  
and routing queries through multiple upstream resolvers like Google DNS and Cloudflare DNS.

---

## 🚀 Features

✅ **RFC-Compliant DNS Parsing**
- Parses raw UDP DNS packets (header, question, answer)
- Handles **compressed domain names** (`0xC0` pointers)
- Supports multiple record types: `A`, `AAAA`, `CNAME`, `MX`, etc.

✅ **TTL-Aware Caching**
- Stores responses using `(name|type|class)` tuples  
- Honors TTL from upstream answers  
- Auto-expires old cache entries every 60 s  

✅ **Multi-Upstream Failover**
- Queries multiple resolvers (`8.8.8.8` → fallback `1.1.1.1`)  
- Retries automatically after timeout (1.5 s)  
- Logs which upstream successfully responded  

✅ **Robust Async Error Handling**
- Handles UDP send and receive errors gracefully  
- Prevents unhandled promise rejections  
- Clean, production-safe async design  

✅ **Developer-Friendly Logging**
- Emoji-coded logs for readability  
- Clear flow of query → cache → upstream → response  
---

## 🧠 Architecture

```text
Client (dig/nslookup)
        │
        ▼
   AuroraDNS (UDP:2053)
   ├── Parse Header + Question
   ├── Check TTL-Aware Cache
   ├── Forward Query → 8.8.8.8 / 1.1.1.1
   ├── Parse Upstream Response
   ├── Cache by (name|type|class)
   └── Send Response to Client
```


## ⚙️ Setup & Installation

### 🧩 1️⃣ Clone the repository
```bash
git clone https://github.com/harshvardhansingh/aurora-dns.git
cd aurora-dns
npm install
npm start
```

## 🧰 Folder Structure

```text
aurora-dns/
├── app/
│   └── main.ts          # Core resolver logic (caching, forwarding)
├── dns/
│   ├── header.ts        # Header parsing/writing
│   ├── question.ts      # Question parsing with compression handling
│   ├── answer.ts        # Answer parsing/writing
│   ├── types.ts         # Enums & constants
├── package.json
├── tsconfig.json
└── .gitignore
```

