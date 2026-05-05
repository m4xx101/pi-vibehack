// Bug-bounty tool catalogue. Hand-curated, ranked by CyberStrike's domain map.
//
// Each entry: a binary name + capabilities + a one-liner invocation hint that
// the Planner can adapt. We deliberately keep this in TS (not YAML) so it
// type-checks and doesn't drag a YAML dep into the cold path. The catalogue is
// exposed via vibehack_tool_search for on-demand discovery; PATH-presence is
// resolved at session_start by lib/tool-detector.ts.

export interface ToolEntry {
  name: string;
  bin: string; // PATH binary name (used by which/where check)
  domain: ("web" | "network" | "cloud" | "mobile" | "recon" | "vuln" | "fuzz" | "report")[];
  capabilities: string[]; // human-readable, used for keyword search
  description: string;
  example: string; // shell example the Planner can adapt
  install?: string; // package name / install hint
}

export const TOOL_CATALOG: ToolEntry[] = [
  // ── Recon ─────────────────────────────────────────────────────────────────
  { name: "subfinder", bin: "subfinder", domain: ["recon"], capabilities: ["subdomain enumeration", "passive dns"],
    description: "Fast passive subdomain enumeration", example: "subfinder -d example.com -silent",
    install: "go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest" },
  { name: "amass", bin: "amass", domain: ["recon"], capabilities: ["subdomain enumeration", "asset discovery", "graph"],
    description: "OWASP Amass — active+passive subdomain mapping", example: "amass enum -d example.com",
    install: "go install -v github.com/owasp-amass/amass/v4/...@master" },
  { name: "assetfinder", bin: "assetfinder", domain: ["recon"], capabilities: ["subdomain enumeration"],
    description: "Lightweight passive subdomain finder", example: "assetfinder --subs-only example.com",
    install: "go install github.com/tomnomnom/assetfinder@latest" },
  { name: "dnsx", bin: "dnsx", domain: ["recon"], capabilities: ["dns resolution", "wildcard detection"],
    description: "Fast DNS toolkit", example: "echo example.com | dnsx -a -resp",
    install: "go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest" },
  { name: "httpx", bin: "httpx", domain: ["recon", "web"], capabilities: ["http probing", "tech detection", "title extraction"],
    description: "Fast HTTP probe + tech fingerprint", example: "echo target | httpx -title -tech-detect -status-code",
    install: "go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest" },
  { name: "naabu", bin: "naabu", domain: ["recon", "network"], capabilities: ["port scanning"],
    description: "Fast SYN port scanner", example: "naabu -host target -top-ports 1000",
    install: "go install -v github.com/projectdiscovery/naabu/v2/cmd/naabu@latest" },
  { name: "nmap", bin: "nmap", domain: ["network", "recon"], capabilities: ["port scanning", "service detection", "os fingerprint", "scripting"],
    description: "Industry-standard network mapper", example: "nmap -sV -sC -p- target",
    install: "apt install nmap" },
  { name: "masscan", bin: "masscan", domain: ["network", "recon"], capabilities: ["port scanning", "internet-scale"],
    description: "Internet-scale port scanner", example: "masscan -p1-65535 target --rate=10000",
    install: "apt install masscan" },

  // ── Web fuzzing & content discovery ───────────────────────────────────────
  { name: "ffuf", bin: "ffuf", domain: ["web", "fuzz"], capabilities: ["directory brute force", "parameter fuzzing", "vhost fuzzing"],
    description: "Fast web fuzzer", example: "ffuf -u https://target/FUZZ -w wordlist.txt",
    install: "go install github.com/ffuf/ffuf/v2@latest" },
  { name: "gobuster", bin: "gobuster", domain: ["web", "fuzz"], capabilities: ["directory brute force", "dns brute force", "vhost"],
    description: "Multi-mode brute-forcer", example: "gobuster dir -u https://target -w wordlist.txt",
    install: "apt install gobuster" },
  { name: "feroxbuster", bin: "feroxbuster", domain: ["web", "fuzz"], capabilities: ["recursive content discovery"],
    description: "Recursive content brute-forcer (Rust)", example: "feroxbuster -u https://target",
    install: "cargo install feroxbuster" },
  { name: "katana", bin: "katana", domain: ["web", "recon"], capabilities: ["web crawling", "endpoint discovery"],
    description: "Next-gen crawler / spider", example: "katana -u https://target -d 5",
    install: "go install github.com/projectdiscovery/katana/cmd/katana@latest" },
  { name: "waybackurls", bin: "waybackurls", domain: ["recon", "web"], capabilities: ["historical urls", "wayback machine"],
    description: "Pull historic URLs from Wayback", example: "echo target.com | waybackurls",
    install: "go install github.com/tomnomnom/waybackurls@latest" },
  { name: "gau", bin: "gau", domain: ["recon", "web"], capabilities: ["historical urls", "passive endpoints"],
    description: "Get all URLs (Wayback + AlienVault + CommonCrawl)", example: "echo target.com | gau",
    install: "go install github.com/lc/gau/v2/cmd/gau@latest" },

  // ── Vulnerability scanners ────────────────────────────────────────────────
  { name: "nuclei", bin: "nuclei", domain: ["vuln", "web"], capabilities: ["template-based scanning", "cve detection", "misconfig scan"],
    description: "Template-driven vuln scanner", example: "nuclei -u https://target -severity high,critical",
    install: "go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest" },
  { name: "nikto", bin: "nikto", domain: ["vuln", "web"], capabilities: ["legacy web scanner", "outdated software"],
    description: "Classic web vuln scanner", example: "nikto -h https://target",
    install: "apt install nikto" },
  { name: "wpscan", bin: "wpscan", domain: ["vuln", "web"], capabilities: ["wordpress scanning", "plugin enum"],
    description: "WordPress-specific scanner", example: "wpscan --url https://target",
    install: "gem install wpscan" },
  { name: "sqlmap", bin: "sqlmap", domain: ["vuln", "web"], capabilities: ["sql injection", "automated exploitation"],
    description: "Automated SQLi detection + exploitation", example: "sqlmap -u 'https://target/?id=1' --batch",
    install: "apt install sqlmap" },
  { name: "dalfox", bin: "dalfox", domain: ["vuln", "web"], capabilities: ["xss scanning", "parameter analysis"],
    description: "XSS scanner", example: "dalfox url https://target?p=1",
    install: "go install github.com/hahwul/dalfox/v2@latest" },

  // ── Cloud / IAM ───────────────────────────────────────────────────────────
  { name: "scout", bin: "scout", domain: ["cloud"], capabilities: ["aws audit", "azure audit", "gcp audit", "misconfig"],
    description: "ScoutSuite multi-cloud auditor", example: "scout aws",
    install: "pip install scoutsuite" },
  { name: "prowler", bin: "prowler", domain: ["cloud"], capabilities: ["aws audit", "cis benchmark", "compliance"],
    description: "Prowler cloud security tool", example: "prowler aws",
    install: "pip install prowler" },
  { name: "pacu", bin: "pacu", domain: ["cloud"], capabilities: ["aws exploitation framework"],
    description: "Pacu — AWS exploitation framework", example: "pacu",
    install: "pip install pacu" },
  { name: "cloudbrute", bin: "cloudbrute", domain: ["cloud", "recon"], capabilities: ["bucket enumeration", "cloud asset discovery"],
    description: "Cloud bucket / asset enumerator", example: "cloudbrute -d example.com -k example",
    install: "go install -v github.com/0xsha/CloudBrute@latest" },

  // ── Mobile ────────────────────────────────────────────────────────────────
  { name: "frida", bin: "frida", domain: ["mobile"], capabilities: ["dynamic instrumentation", "android hooking", "ios hooking"],
    description: "Dynamic instrumentation toolkit", example: "frida -U -f com.target",
    install: "pip install frida-tools" },
  { name: "objection", bin: "objection", domain: ["mobile"], capabilities: ["frida wrapper", "mobile pentest"],
    description: "Runtime mobile exploration via Frida", example: "objection -g com.target explore",
    install: "pip install objection" },
  { name: "apktool", bin: "apktool", domain: ["mobile"], capabilities: ["apk decode", "smali patch"],
    description: "Reverse engineer Android APKs", example: "apktool d target.apk",
    install: "apt install apktool" },
  { name: "jadx", bin: "jadx", domain: ["mobile"], capabilities: ["dex decompilation", "java source"],
    description: "DEX → Java decompiler", example: "jadx target.apk -d out",
    install: "apt install jadx" },

  // ── AD / network ──────────────────────────────────────────────────────────
  { name: "nxc", bin: "nxc", domain: ["network"], capabilities: ["smb enumeration", "credential spraying", "lateral movement"],
    description: "NetExec (CrackMapExec successor)", example: "nxc smb 10.0.0.0/24 -u user -p pass",
    install: "pipx install netexec" },
  { name: "impacket-secretsdump", bin: "impacket-secretsdump", domain: ["network"], capabilities: ["dcsync", "credential extraction"],
    description: "Impacket secretsdump", example: "impacket-secretsdump domain/user@target",
    install: "pipx install impacket" },
  { name: "bloodhound-python", bin: "bloodhound-python", domain: ["network"], capabilities: ["ad enumeration", "graph collection"],
    description: "BloodHound python collector", example: "bloodhound-python -d corp.local -u user -p pass -c All",
    install: "pipx install bloodhound" },
  { name: "responder", bin: "responder", domain: ["network"], capabilities: ["llmnr poisoning", "credential capture"],
    description: "LLMNR/NBT-NS/MDNS poisoner", example: "responder -I eth0",
    install: "apt install responder" },
  { name: "hydra", bin: "hydra", domain: ["network", "vuln"], capabilities: ["password brute force", "credential testing"],
    description: "Network login brute-forcer", example: "hydra -L users.txt -P pass.txt target ssh",
    install: "apt install hydra" },

  // ── Generic ───────────────────────────────────────────────────────────────
  { name: "curl", bin: "curl", domain: ["recon", "web"], capabilities: ["http requests", "manual probing"],
    description: "HTTP swiss-army knife", example: "curl -sIL https://target", install: "apt install curl" },
  { name: "jq", bin: "jq", domain: ["recon", "report"], capabilities: ["json parsing", "filtering"],
    description: "Command-line JSON processor", example: "cat data.json | jq '.results[].url'",
    install: "apt install jq" },
];
