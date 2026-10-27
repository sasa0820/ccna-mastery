import { QuestionItem } from '../types/question';

export type IosMode =
  | 'user'          // Router>
  | 'priv'          // Router#
  | 'config'        // Router(config)#
  | 'config-if'     // Router(config-if)# or (config-if-range)#
  | 'config-subif'  // Router(config-subif)#
  | 'config-router' // Router(config-router)#
  | 'config-vlan'   // Switch(config-vlan)#
  | 'config-line'   // Router(config-line)#
  | 'config-nacl'   // Router(config-std-nacl)# / Router(config-ext-nacl)#
  | 'config-dhcp';  // Router(dhcp-config)#

export interface RequiredCliStep {
  id: string;
  device: string;
  modePrompt: string;
  rawCommand: string;
  canonicalCommand: string;
  completed: boolean;
}

export interface TopologyNode {
  id: string;
  label: string;
  type: 'router' | 'switch' | 'pc' | 'server' | 'cloud';
  x: number;
  y: number;
  ipInfo?: string;
}

export interface TopologyLink {
  from: string;
  to: string;
  fromPort?: string;
  toPort?: string;
  subnetLabel?: string;
  isTrunkOrPo?: boolean;
}

export interface ParsedTopology {
  nodes: TopologyNode[];
  links: TopologyLink[];
  devices: string[];
}

/**
 * Canonicalizes a Cisco IOS command so common CCNA abbreviations match the full or abbreviated form:
 * e.g. "int e0/0" === "interface ethernet0/0" === "interface e0/0"
 *      "conf t" === "configure terminal"
 *      "sh ip int br" === "show ip interface brief"
 *      "copy run start" === "copy running-config startup-config" === "write memory"
 */
export function canonicalizeIosCommand(raw: string): string {
  let cmd = raw
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  // Strip trailing comments or inline annotations
  cmd = cmd.replace(/\s*(\/\/|＊|\*).*$/, '').trim();

  // Normalize interface names: gigabitethernet0/0 -> g0/0, fastethernet0/1 -> f0/1, ethernet0/0 -> e0/0, port-channel -> po, loopback -> lo
  cmd = cmd
    .replace(/\bgigabitethernet\s*/g, 'g')
    .replace(/\bgi\s*(?=\d)/g, 'g')
    .replace(/\bgig\s*(?=\d)/g, 'g')
    .replace(/\bfastethernet\s*/g, 'f')
    .replace(/\bfa\s*(?=\d)/g, 'f')
    .replace(/\bethernet\s*/g, 'e')
    .replace(/\beth\s*(?=\d)/g, 'e')
    .replace(/\bport-channel\s*/g, 'po')
    .replace(/\bloopback\s*/g, 'lo')
    .replace(/\bserial\s*/g, 's')
    .replace(/\bvlan\s+(\d+)/g, 'vlan $1');

  // Normalize interface range spacing: "e0/0 - 1" or "e0/0-1" -> "e0/0-1"
  cmd = cmd.replace(/([efgs]\d+\/\d+(?:\/\d+)?)\s*-\s*(\d+)/g, '$1-$2');

  const tokens = cmd.split(' ');
  if (tokens.length === 0 || !tokens[0]) return '';

  // Map common first/second token abbreviations
  const w0 = tokens[0];
  if (w0 === 'en' || w0 === 'ena' || w0 === 'enab' || w0 === 'enabl') tokens[0] = 'enable';
  if (w0 === 'conf' || w0 === 'config' || w0 === 'configure') {
    tokens[0] = 'configure';
    if (!tokens[1] || tokens[1].startsWith('t')) {
      tokens[1] = 'terminal';
    }
  }
  if (w0 === 'int' || w0 === 'inter' || w0 === 'interf' || w0 === 'interfa' || w0 === 'interfac') {
    tokens[0] = 'interface';
  }
  if (w0 === 'sh' || w0 === 'sho') tokens[0] = 'show';
  if (w0 === 'wr' || (w0 === 'write' && (!tokens[1] || tokens[1].startsWith('m')))) {
    return 'copy running-config startup-config';
  }
  if (w0 === 'copy' && tokens[1]?.startsWith('run') && tokens[2]?.startsWith('start')) {
    return 'copy running-config startup-config';
  }

  // Handle "no shut" / "no shutdown"
  if (tokens[0] === 'no' && tokens[1]?.startsWith('shut')) {
    return 'no shutdown';
  }
  if (tokens[0]?.startsWith('shut')) {
    return 'shutdown';
  }

  // Handle switchport abbreviations: "sw m a" -> "switchport mode access", "sw m t" -> "switchport mode trunk", etc.
  if (tokens[0] === 'sw' || tokens[0].startsWith('switchp')) {
    tokens[0] = 'switchport';
    if (tokens[1] === 'm' || tokens[1]?.startsWith('mod')) tokens[1] = 'mode';
    if (tokens[1] === 'a' || tokens[1]?.startsWith('acc')) tokens[1] = 'access';
    if (tokens[1] === 't' || tokens[1]?.startsWith('tru')) tokens[1] = 'trunk';
    if (tokens[1] === 'v' || tokens[1]?.startsWith('voi')) tokens[1] = 'voice';
    if (tokens[1] === 'p' || tokens[1]?.startsWith('port-sec')) tokens[1] = 'port-security';

    if (tokens[1] === 'mode') {
      if (tokens[2]?.startsWith('a')) tokens[2] = 'access';
      if (tokens[2]?.startsWith('t')) tokens[2] = 'trunk';
      if (tokens[2]?.startsWith('d')) tokens[2] = 'dynamic';
    }
    if (tokens[1] === 'trunk') {
      if (tokens[2]?.startsWith('enc')) tokens[2] = 'encapsulation';
      if (tokens[2]?.startsWith('nat')) tokens[2] = 'native';
      if (tokens[2]?.startsWith('all')) tokens[2] = 'allowed';
    }
    if (tokens[1] === 'port-security') {
      if (tokens[2]?.startsWith('max')) tokens[2] = 'maximum';
      if (tokens[2]?.startsWith('vio')) tokens[2] = 'violation';
      if (tokens[2]?.startsWith('mac')) tokens[2] = 'mac-address';
    }
  }

  // Handle "channel-group X mode active/passive/desirable/auto/on"
  if (tokens[0].startsWith('channel-g')) {
    tokens[0] = 'channel-group';
  }

  // Handle "ip add" -> "ip address", "ipv6 add" -> "ipv6 address"
  if ((tokens[0] === 'ip' || tokens[0] === 'ipv6') && tokens[1]?.startsWith('add')) {
    tokens[1] = 'address';
  }
  if (tokens[0] === 'ip' && tokens[1]?.startsWith('helper')) {
    tokens[1] = 'helper-address';
  }
  if (tokens[0] === 'ip' && tokens[1] === 'nat' && tokens[2]?.startsWith('in')) {
    tokens[2] = 'inside';
  }
  if (tokens[0] === 'ip' && tokens[1] === 'nat' && tokens[2]?.startsWith('out')) {
    tokens[2] = 'outside';
  }

  // Normalize "eq 80" <-> "eq www", "eq 23" <-> "eq telnet", "eq 22" <-> "eq ssh"
  const joined = tokens.join(' ');
  return joined
    .replace(/\beq\s+80\b/g, 'eq www')
    .replace(/\beq\s+23\b/g, 'eq telnet')
    .replace(/\beq\s+443\b/g, 'eq 443');
}

/**
 * Extracts structured required CLI steps from a simulation question's solution / correctAnswers.
 * Filters out navigation-only commands (`enable`, `conf t`, `exit`, `end`, `show ...`, `ping ...`, `y`, `yes`)
 * so the user's progress checklist focuses on actual configuration & operational requirements,
 * OR keeps `copy run start` / `clear ip ospf process` when explicitly part of the solution.
 */
export function extractRequiredCliSteps(question: QuestionItem): RequiredCliStep[] {
  const rawText = question.solution || (question.correctAnswers || []).join('\n');
  if (!rawText) return [];

  const lines = rawText.split(/\r?\n/);
  const steps: RequiredCliStep[] = [];
  let currentDevices = ['R1'];

  // Navigation / read-only commands that shouldn't block completion if the user achieved the config
  const navCommands = new Set([
    'enable',
    'configure terminal',
    'exit',
    'end',
    'y',
    'yes',
  ]);

  let stepIdx = 1;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//') || line.startsWith('＊') || line.startsWith('*') || line.startsWith('★')) {
      continue;
    }

    // Match standalone device header like "Sw1:" or "SW1, SW2:"
    const headerMatch = line.match(/^([A-Za-z0-9\-_,\s]+):$/);
    if (headerMatch && !line.includes('タスク')) {
      const devs = headerMatch[1]
        .split(/[,、\s]+/)
        .map(d => d.trim())
        .filter(Boolean);
      if (devs.length > 0) {
        currentDevices = devs;
      }
      continue;
    }

    // Match Cisco prompt line: e.g. "R1(config)#router ospf 1" or "SW1,2(config-if)#channel-group 44 mode active" or "1 Sw1(config)# hostname Sw1"
    const promptMatch = line.match(/^(?:\d+\s+)?([A-Za-z0-9\-_,\s#]+?)?(\([a-z0-9\-]+\))?([#>])\s*(.+)$/);
    if (!promptMatch) continue;

    const rawDevPart = (promptMatch[1] || '').trim();
    const modePart = promptMatch[2] || '';
    const promptChar = promptMatch[3];
    const cmdPart = promptMatch[4].trim();

    if (!cmdPart) continue;

    // Expand shorthand device names like "SW1,2" -> ["SW1", "SW2"] or "R1#,R2#" -> ["R1", "R2"]
    if (rawDevPart) {
      const cleanedDev = rawDevPart.replace(/#/g, '').trim();
      const parts = cleanedDev.split(/[,、]\s*/).filter(Boolean);
      const expanded: string[] = [];
      let prefix = '';
      for (const p of parts) {
        const m = p.match(/^([A-Za-z\-]+)(\d+)$/);
        if (m) {
          prefix = m[1];
          expanded.push(`${m[1]}${m[2]}`);
        } else if (/^\d+$/.test(p) && prefix) {
          expanded.push(`${prefix}${p}`);
        } else if (p) {
          expanded.push(p);
        }
      }
      if (expanded.length > 0) {
        currentDevices = expanded;
      }
    }

    const canonical = canonicalizeIosCommand(cmdPart);
    if (!canonical || navCommands.has(canonical)) continue;
    // Skip pure verification commands (`show ...`, `ping ...`) in the required grading checklist
    if (canonical.startsWith('show ') || canonical.startsWith('ping ')) continue;

    for (const dev of currentDevices) {
      const normalizedDev = dev.toUpperCase();
      // Avoid duplicate identical consecutive commands on same device (except `interface ...` which may re-enter)
      steps.push({
        id: `step_${stepIdx++}`,
        device: normalizedDev,
        modePrompt: `${normalizedDev}${modePart}${promptChar}`,
        rawCommand: cmdPart,
        canonicalCommand: canonical,
        completed: false,
      });
    }
  }

  return steps;
}

/**
 * Extracts a visual network topology (nodes + links + devices) from the simulation question's
 * diagramDescription, questionText, and solution commands so every single simulation has a clear,
 * interactive SVG topology diagram on the left pane.
 */
export function buildSimulationTopology(question: QuestionItem, siblingQuestions: QuestionItem[] = []): ParsedTopology {
  const sameScenario = siblingQuestions.filter(
    q => q.type === 'simulation' && q.scenarioTitle && q.scenarioTitle === question.scenarioTitle
  );
  const combinedText = [
    ...sameScenario.map(q => q.diagramDescription || ''),
    question.diagramDescription || '',
    question.questionText || '',
    question.solution || '',
  ].join('\n');

  // Discover all device names mentioned
  const deviceSet = new Set<string>();
  const devRegex = /\b(R[1-6]|HQ[1-3]|Gw1|ISP|SW-?[1-4]|Sw-?[1-4]|SW10[1-4]|Sw10[1-4]|PC[1-5]|Server\d*|Host\s*[A-D])\b/g;
  let match: RegExpExecArray | null;
  while ((match = devRegex.exec(combinedText)) !== null) {
    const raw = match[1].toUpperCase().replace(/\s+/g, '');
    deviceSet.add(raw);
  }

  // Normalize aliases (e.g. if both SW1 and SW-1 appear, prefer the one in solution)
  const steps = extractRequiredCliSteps(question);
  const cliDevices = Array.from(new Set(steps.map(s => s.device.toUpperCase())));
  for (const d of cliDevices) {
    deviceSet.add(d);
  }

  if (deviceSet.size === 0) {
    deviceSet.add('R1');
    deviceSet.add('SW1');
  } else if (deviceSet.size === 1) {
    const only = Array.from(deviceSet)[0];
    if (only.startsWith('SW')) {
      deviceSet.add('R1');
      deviceSet.add('PC1');
    } else {
      deviceSet.add('SW1');
      deviceSet.add('PC1');
    }
  }

  const allDevs = Array.from(deviceSet);

  // Classify nodes by layer for clean hierarchical SVG layout:
  // Top row (y=65): Routers / Gateways / ISP
  // Middle row (y=175): Switches
  // Bottom row (y=280): PCs / Servers / Hosts
  const routers = allDevs.filter(d => /^(R\d|HQ\d|GW\d|ISP)/.test(d)).sort();
  const switches = allDevs.filter(d => /^SW/.test(d)).sort();
  const hosts = allDevs.filter(d => /^(PC|SERVER|HOST)/.test(d)).sort();

  const nodes: TopologyNode[] = [];
  const placeRow = (items: string[], y: number, typeFn: (id: string) => TopologyNode['type']) => {
    const count = items.length;
    if (count === 0) return;
    const width = 540;
    const spacing = count === 1 ? width / 2 : width / (count + 0.6);
    items.forEach((id, idx) => {
      // Extract IP/VLAN hint for this device from diagramDescription if available
      const ipMatch = combinedText.match(new RegExp(`${id}\\s*\\(([^)]+)\\)`, 'i'));
      nodes.push({
        id,
        label: id,
        type: typeFn(id),
        x: count === 1 ? 300 : Math.round(30 + spacing * (idx + 0.8)),
        y,
        ipInfo: ipMatch ? ipMatch[1].slice(0, 36) : undefined,
      });
    });
  };

  // If only routers exist, arrange them in a wide triangle or two rows
  if (switches.length === 0 && hosts.length === 0 && routers.length >= 3) {
    const topRouters = routers.slice(0, Math.ceil(routers.length / 2));
    const botRouters = routers.slice(Math.ceil(routers.length / 2));
    placeRow(topRouters, 70, id => (id === 'ISP' ? 'cloud' : 'router'));
    placeRow(botRouters, 245, id => (id === 'ISP' ? 'cloud' : 'router'));
  } else {
    const hasTop = routers.length > 0;
    const hasMid = switches.length > 0;
    const hasBot = hosts.length > 0;
    if (hasTop && hasMid && hasBot) {
      placeRow(routers, 65, id => (id === 'ISP' ? 'cloud' : 'router'));
      placeRow(switches, 175, () => 'switch');
      placeRow(hosts, 280, id => (id.startsWith('SERVER') ? 'server' : 'pc'));
    } else if (hasTop && hasMid) {
      placeRow(routers, 95, id => (id === 'ISP' ? 'cloud' : 'router'));
      placeRow(switches, 230, () => 'switch');
    } else if (hasMid && hasBot) {
      placeRow(switches, 95, () => 'switch');
      placeRow(hosts, 235, id => (id.startsWith('SERVER') ? 'server' : 'pc'));
    } else {
      placeRow(allDevs, 160, id => {
        if (id === 'ISP') return 'cloud';
        if (id.startsWith('SW')) return 'switch';
        if (id.startsWith('PC') || id.startsWith('HOST')) return 'pc';
        if (id.startsWith('SERVER')) return 'server';
        return 'router';
      });
    }
  }

  // Extract explicit links from "A ── B" patterns in diagramDescription, and add logical links
  const links: TopologyLink[] = [];
  const addedPairs = new Set<string>();
  const addLink = (a: string, b: string, fromPort?: string, toPort?: string, subnetLabel?: string, isTrunkOrPo?: boolean) => {
    if (a === b) return;
    const key = [a, b].sort().join('--');
    if (addedPairs.has(key)) return;
    if (!nodes.some(n => n.id === a) || !nodes.some(n => n.id === b)) return;
    addedPairs.add(key);
    links.push({ from: a, to: b, fromPort, toPort, subnetLabel, isTrunkOrPo });
  };

  // Parse lines with ── or - between devices
  const diagLines = (question.diagramDescription || '').split(/\r?\n/);
  for (const line of diagLines) {
    const devMatches = Array.from(line.matchAll(/\b(R[1-6]|HQ[1-3]|Gw1|ISP|SW-?[1-4]|Sw-?[1-4]|SW10[1-4]|Sw10[1-4]|PC[1-5]|Server\d*)\b/gi)).map(
      m => m[1].toUpperCase()
    );
    const portMatches = Array.from(line.matchAll(/\b([efg]0\/\d(?:\s*-\s*\d)?|Po\s*\d+)\b/gi)).map(m => m[1]);
    const subnetMatch = line.match(/\b(\d+\.\d+\.\d+\.\d+\/\d+|2001:db8:[0-9a-f:]+\/\d+|VLAN\s*\d+|Po\s*\d+)\b/i);
    for (let i = 0; i < devMatches.length - 1; i++) {
      addLink(
        devMatches[i],
        devMatches[i + 1],
        portMatches[i],
        portMatches[i + 1],
        subnetMatch ? subnetMatch[1] : undefined,
        /trunk|po\s*\d+|lacp/i.test(line)
      );
    }
  }

  // Ensure connected graph if some nodes have no explicit links
  for (let i = 0; i < routers.length - 1; i++) {
    addLink(routers[i], routers[i + 1], 'e0/0', 'e0/0');
  }
  for (let i = 0; i < switches.length - 1; i++) {
    addLink(switches[i], switches[i + 1], 'e0/0', 'e0/0', undefined, true);
  }
  if (routers.length > 0 && switches.length > 0) {
    addLink(routers[0], switches[0], 'e0/1', 'e0/2');
  }
  hosts.forEach((h, idx) => {
    const targetSw = switches[idx % Math.max(1, switches.length)] || routers[0];
    if (targetSw) {
      addLink(targetSw, h, `e0/${idx + 1}`, 'eth0');
    }
  });

  // Configurable CLI devices (prioritize devices with steps in solution, fallback to routers/switches)
  const configurableDevices =
    cliDevices.length > 0
      ? cliDevices
      : [...routers.filter(r => r !== 'ISP'), ...switches].slice(0, 4);

  return {
    nodes,
    links,
    devices: configurableDevices.length > 0 ? configurableDevices : ['R1'],
  };
}

/**
 * Context-sensitive `?` help and `Tab` completion dictionary per IOS mode.
 */
const MODE_COMMANDS: Record<IosMode, { cmd: string; desc: string }[]> = {
  user: [
    { cmd: 'enable', desc: 'Turn on privileged commands' },
    { cmd: 'ping', desc: 'Send echo messages' },
    { cmd: 'show', desc: 'Show running system information' },
    { cmd: 'exit', desc: 'Exit from the EXEC' },
  ],
  priv: [
    { cmd: 'configure terminal', desc: 'Enter configuration mode from terminal' },
    { cmd: 'copy running-config startup-config', desc: 'Save running configuration to startup configuration' },
    { cmd: 'show running-config', desc: 'Current operating configuration' },
    { cmd: 'show ip interface brief', desc: 'Brief IP interface status and configuration' },
    { cmd: 'show ip route', desc: 'IP routing table' },
    { cmd: 'show vlan brief', desc: 'Summary of VLAN status' },
    { cmd: 'show etherchannel summary', desc: 'EtherChannel summary status' },
    { cmd: 'show ip ospf neighbor', desc: 'OSPF neighbor list' },
    { cmd: 'show cdp neighbors', desc: 'CDP neighbor entries' },
    { cmd: 'show lldp neighbors', desc: 'LLDP neighbor entries' },
    { cmd: 'clear ip ospf process', desc: 'Reset OSPF processes' },
    { cmd: 'ping', desc: 'Send echo messages' },
    { cmd: 'write memory', desc: 'Write running configuration to non-volatile memory' },
    { cmd: 'disable', desc: 'Turn off privileged commands' },
  ],
  config: [
    { cmd: 'interface', desc: 'Select an interface to configure (e.g. e0/0, range e0/0 - 1, vlan 10, port-channel 1)' },
    { cmd: 'router ospf', desc: 'Configure OSPF routing process' },
    { cmd: 'ip route', desc: 'Establish static routes' },
    { cmd: 'ipv6 route', desc: 'Establish IPv6 static routes' },
    { cmd: 'vlan', desc: 'Configure VLAN parameters (e.g. vlan 10, vlan dot1q tag native)' },
    { cmd: 'ip access-list', desc: 'Named access-list configuration (standard / extended)' },
    { cmd: 'ip nat inside source', desc: 'Configure NAT inside source translation' },
    { cmd: 'ip dhcp pool', desc: 'Configure DHCP address pool' },
    { cmd: 'ip dhcp excluded-address', desc: 'Prevent DHCP from assigning certain addresses' },
    { cmd: 'ip dhcp snooping', desc: 'Global DHCP Snooping configuration' },
    { cmd: 'ntp server', desc: 'Configure NTP server peer' },
    { cmd: 'ntp master', desc: 'Act as NTP master clock' },
    { cmd: 'ntp source', desc: 'Configure interface for NTP source address' },
    { cmd: 'cdp run', desc: 'Enable CDP globally' },
    { cmd: 'lldp run', desc: 'Enable LLDP globally' },
    { cmd: 'hostname', desc: 'Set system network name' },
    { cmd: 'ip domain-name', desc: 'Define the default domain name' },
    { cmd: 'username', desc: 'Establish User Name Authentication' },
    { cmd: 'crypto key generate rsa', desc: 'Generate RSA keys for SSH' },
    { cmd: 'line vty 0 4', desc: 'Configure virtual terminal lines' },
    { cmd: 'exit', desc: 'Exit from configure mode' },
    { cmd: 'end', desc: 'Exit to privileged EXEC mode' },
  ],
  'config-if': [
    { cmd: 'ip address', desc: 'Set the IP address of an interface' },
    { cmd: 'ipv6 address', desc: 'Set the IPv6 address of an interface' },
    { cmd: 'no shutdown', desc: 'Enable the selected interface' },
    { cmd: 'shutdown', desc: 'Shutdown the selected interface' },
    { cmd: 'switchport mode access', desc: 'Set trunking mode to ACCESS unconditionally' },
    { cmd: 'switchport mode trunk', desc: 'Set trunking mode to TRUNK unconditionally' },
    { cmd: 'switchport access vlan', desc: 'Set VLAN when interface is in access mode' },
    { cmd: 'switchport voice vlan', desc: 'Set VLAN for voice traffic' },
    { cmd: 'switchport trunk encapsulation dot1q', desc: 'Set IEEE 802.1Q trunking encapsulation' },
    { cmd: 'switchport trunk native vlan', desc: 'Set native VLAN for untagged traffic' },
    { cmd: 'switchport trunk allowed vlan', desc: 'Set allowed VLANs on trunk interface' },
    { cmd: 'switchport port-security', desc: 'Enable port-security on the interface' },
    { cmd: 'switchport port-security maximum', desc: 'Set maximum secure MAC addresses' },
    { cmd: 'switchport port-security violation', desc: 'Set security violation mode (protect / restrict / shutdown)' },
    { cmd: 'switchport port-security mac-address sticky', desc: 'Enable sticky MAC learning' },
    { cmd: 'channel-group', desc: 'Configure EtherChannel/LACP (e.g. channel-group 1 mode active)' },
    { cmd: 'ip ospf priority', desc: 'Router priority for OSPF DR/BDR election' },
    { cmd: 'ip ospf network point-to-point', desc: 'Specify OSPF point-to-point network type' },
    { cmd: 'ip ospf', desc: 'Enable OSPF on this interface (ip ospf <pid> area <id>)' },
    { cmd: 'ip helper-address', desc: 'Specify a destination address for UDP broadcasts (DHCP relay)' },
    { cmd: 'ip nat inside', desc: 'Mark interface as NAT inside' },
    { cmd: 'ip nat outside', desc: 'Mark interface as NAT outside' },
    { cmd: 'ip access-group', desc: 'Specify access control for packets (in / out)' },
    { cmd: 'ip dhcp snooping trust', desc: 'Configure interface as trusted for DHCP Snooping' },
    { cmd: 'ip dhcp snooping limit rate', desc: 'Configure DHCP packet rate limit' },
    { cmd: 'no switchport', desc: 'Configure port as Layer 3 routed interface' },
    { cmd: 'no cdp enable', desc: 'Disable CDP on this interface' },
    { cmd: 'lldp transmit', desc: 'Enable LLDP transmission on interface' },
    { cmd: 'lldp receive', desc: 'Enable LLDP reception on interface' },
    { cmd: 'no lldp transmit', desc: 'Disable LLDP transmission on interface' },
    { cmd: 'no lldp receive', desc: 'Disable LLDP reception on interface' },
    { cmd: 'interface', desc: 'Switch directly to another interface' },
    { cmd: 'exit', desc: 'Exit from interface configuration mode' },
    { cmd: 'end', desc: 'Return to privileged EXEC mode' },
  ],
  'config-subif': [
    { cmd: 'encapsulation dot1q', desc: 'Set IEEE 802.1Q VLAN ID for subinterface' },
    { cmd: 'ip address', desc: 'Set IPv4 address and mask' },
    { cmd: 'ip access-group', desc: 'Apply ACL to subinterface (in / out)' },
    { cmd: 'ip nat inside', desc: 'Mark subinterface as NAT inside' },
    { cmd: 'exit', desc: 'Exit from subinterface configuration mode' },
    { cmd: 'end', desc: 'Return to privileged EXEC mode' },
  ],
  'config-router': [
    { cmd: 'router-id', desc: 'Router-id for this OSPF process (A.B.C.D)' },
    { cmd: 'network', desc: 'Enable routing on an IP network (network <ip> <wildcard> area <id>)' },
    { cmd: 'passive-interface', desc: 'Suppress routing updates on an interface' },
    { cmd: 'default-information originate', desc: 'Distribute a default route' },
    { cmd: 'exit', desc: 'Exit from routing protocol configuration mode' },
    { cmd: 'end', desc: 'Return to privileged EXEC mode' },
  ],
  'config-vlan': [
    { cmd: 'name', desc: 'Ascii name of the VLAN' },
    { cmd: 'vlan', desc: 'Configure another VLAN ID' },
    { cmd: 'exit', desc: 'Apply changes and exit from VLAN configuration mode' },
    { cmd: 'end', desc: 'Return to privileged EXEC mode' },
  ],
  'config-line': [
    { cmd: 'transport input ssh', desc: 'Allow only SSH for incoming VTY connections' },
    { cmd: 'transport input telnet', desc: 'Allow only Telnet for incoming VTY connections' },
    { cmd: 'transport input all', desc: 'Allow all protocols for incoming VTY connections' },
    { cmd: 'login local', desc: 'Authenticate using local username database' },
    { cmd: 'password', desc: 'Set line password' },
    { cmd: 'exec-timeout', desc: 'Set EXEC timeout' },
    { cmd: 'exit', desc: 'Exit from line configuration mode' },
    { cmd: 'end', desc: 'Return to privileged EXEC mode' },
  ],
  'config-nacl': [
    { cmd: 'permit', desc: 'Specify packets to forward (e.g. permit tcp/udp/ip/icmp ...)' },
    { cmd: 'deny', desc: 'Specify packets to reject (e.g. deny tcp/udp/ip/icmp ...)' },
    { cmd: 'exit', desc: 'Exit from access-list configuration mode' },
    { cmd: 'end', desc: 'Return to privileged EXEC mode' },
  ],
  'config-dhcp': [
    { cmd: 'network', desc: 'Network number and mask for DHCP pool' },
    { cmd: 'default-router', desc: 'Default routers / gateway for DHCP clients' },
    { cmd: 'dns-server', desc: 'DNS servers for DHCP clients' },
    { cmd: 'exit', desc: 'Exit from DHCP pool configuration mode' },
    { cmd: 'end', desc: 'Return to privileged EXEC mode' },
  ],
};

/**
 * Computes Tab auto-completion for the current input and IOS mode, plus task-specific commands.
 */
export function getTabCompletion(
  input: string,
  mode: IosMode,
  deviceSteps: RequiredCliStep[] = []
): { completedInput: string; suggestions: string[] } {
  const trimmed = input.trimStart();
  if (!trimmed) {
    return { completedInput: input, suggestions: [] };
  }

  const lower = trimmed.toLowerCase();
  const modeCmds = MODE_COMMANDS[mode] || [];

  // Combine standard mode commands + task-specific raw commands for this device so Tab can complete parameters too!
  const candidates: string[] = [
    ...modeCmds.map(c => c.cmd),
    ...deviceSteps.map(s => s.rawCommand),
  ];

  // 1. Check if full input matches a candidate prefix
  const fullMatches = Array.from(
    new Set(candidates.filter(c => c.toLowerCase().startsWith(lower)))
  );

  if (fullMatches.length === 1) {
    return {
      completedInput: fullMatches[0] + ' ',
      suggestions: fullMatches,
    };
  }

  // 2. Token-by-token completion (e.g., "sw m " -> "switchport mode ", "int e0/0" -> "interface e0/0")
  const tokens = trimmed.split(/\s+/);
  const lastToken = tokens[tokens.length - 1].toLowerCase();
  const prefixTokens = tokens.slice(0, -1);

  const dictionaryWords = [
    'enable', 'configure', 'terminal', 'interface', 'range', 'ethernet0/0', 'ethernet0/1', 'ethernet0/2', 'ethernet0/3',
    'gigabitethernet0/0', 'gigabitethernet0/1', 'port-channel', 'loopback0', 'vlan',
    'switchport', 'mode', 'access', 'trunk', 'encapsulation', 'dot1q', 'native', 'allowed', 'voice',
    'port-security', 'maximum', 'violation', 'protect', 'restrict', 'shutdown', 'mac-address', 'sticky',
    'channel-group', 'active', 'passive', 'desirable', 'auto',
    'router', 'ospf', 'router-id', 'network', 'area', 'priority', 'point-to-point',
    'ip', 'ipv6', 'address', 'route', 'helper-address', 'nat', 'inside', 'outside', 'source', 'list', 'overload',
    'access-list', 'standard', 'extended', 'access-group', 'permit', 'deny', 'host', 'any', 'eq', 'www', 'telnet', 'bootpc',
    'dhcp', 'pool', 'excluded-address', 'snooping', 'trust', 'verify', 'information', 'option', 'limit', 'rate',
    'ntp', 'server', 'master', 'cdp', 'run', 'lldp', 'transmit', 'receive',
    'username', 'privilege', 'algorithm-type', 'scrypt', 'sha256', 'secret', 'password',
    'line', 'vty', 'transport', 'input', 'ssh', 'login', 'local', 'domain-name', 'hostname', 'crypto', 'key', 'generate', 'rsa',
    'copy', 'running-config', 'startup-config', 'show', 'brief', 'clear', 'process', 'exit', 'end',
  ];

  const wordMatches = dictionaryWords.filter(w => w.startsWith(lastToken));
  if (wordMatches.length === 1) {
    const newInput = [...prefixTokens, wordMatches[0]].join(' ') + ' ';
    return { completedInput: newInput, suggestions: wordMatches };
  }

  return {
    completedInput: input,
    suggestions: fullMatches.length > 0 ? fullMatches : wordMatches,
  };
}

/**
 * Generates context-sensitive `?` help output for the current IOS mode and input prefix.
 */
export function getContextHelp(
  input: string,
  mode: IosMode,
  deviceSteps: RequiredCliStep[] = []
): string[] {
  const trimmed = input.replace(/\?+$/, '').trim();
  const lower = trimmed.toLowerCase();
  const list = MODE_COMMANDS[mode] || [];

  const filtered = lower
    ? list.filter(item => item.cmd.toLowerCase().startsWith(lower))
    : list;

  const lines: string[] = ['Exec / Configuration commands:'];
  for (const item of filtered) {
    lines.push(`  ${item.cmd.padEnd(36, ' ')} ${item.desc}`);
  }

  // Also show a subtle hint of relevant commands for this scenario if in matching mode
  const uncompleted = deviceSteps.filter(s => !s.completed);
  if (uncompleted.length > 0) {
    lines.push('');
    lines.push('Scenario Target Command Hints (?):');
    for (const step of uncompleted.slice(0, 5)) {
      lines.push(`  * ${step.rawCommand}`);
    }
  }

  return lines;
}

/**
 * Formats the realistic Cisco IOS prompt string for a device and mode.
 */
export function formatIosPrompt(device: string, mode: IosMode): string {
  switch (mode) {
    case 'user':
      return `${device}>`;
    case 'priv':
      return `${device}#`;
    case 'config':
      return `${device}(config)#`;
    case 'config-if':
      return `${device}(config-if)#`;
    case 'config-subif':
      return `${device}(config-subif)#`;
    case 'config-router':
      return `${device}(config-router)#`;
    case 'config-vlan':
      return `${device}(config-vlan)#`;
    case 'config-line':
      return `${device}(config-line)#`;
    case 'config-nacl':
      return `${device}(config-ext-nacl)#`;
    case 'config-dhcp':
      return `${device}(dhcp-config)#`;
  }
}

/**
 * Evaluates a single CLI command entered by the user on a specific device,
 * updating the IOS mode state machine, returning terminal output lines,
 * and marking any matching required CLI step as completed!
 */
export function processCliCommand(
  rawInput: string,
  currentDevice: string,
  currentMode: IosMode,
  steps: RequiredCliStep[],
  question: QuestionItem
): {
  nextMode: IosMode;
  outputLines: string[];
  updatedSteps: RequiredCliStep[];
  matchedStep?: RequiredCliStep;
} {
  const trimmed = rawInput.trim();
  const canonical = canonicalizeIosCommand(trimmed);
  const outputLines: string[] = [];
  let nextMode: IosMode = currentMode;

  if (!canonical) {
    return { nextMode, outputLines, updatedSteps: steps };
  }

  // Mode transitions
  if (canonical === 'enable') {
    nextMode = 'priv';
  } else if (canonical === 'disable') {
    nextMode = 'user';
  } else if (canonical === 'configure terminal') {
    nextMode = 'config';
    outputLines.push('Enter configuration commands, one per line.  End with CNTL/Z.');
  } else if (canonical === 'end') {
    nextMode = 'priv';
    outputLines.push(`%SYS-5-CONFIG_I: Configured from console by console`);
  } else if (canonical === 'exit') {
    if (currentMode === 'config') {
      nextMode = 'priv';
    } else if (currentMode === 'priv') {
      nextMode = 'user';
    } else if (currentMode !== 'user') {
      nextMode = 'config';
    }
  } else if (canonical.startsWith('interface ')) {
    nextMode = canonical.includes('.') ? 'config-subif' : 'config-if';
  } else if (canonical.startsWith('router ')) {
    nextMode = 'config-router';
  } else if (/^vlan\s+\d+/.test(canonical)) {
    nextMode = 'config-vlan';
  } else if (canonical.startsWith('line ')) {
    nextMode = 'config-line';
  } else if (canonical.startsWith('ip access-list ')) {
    nextMode = 'config-nacl';
  } else if (canonical.startsWith('ip dhcp pool ')) {
    nextMode = 'config-dhcp';
  }

  // Handle show / ping / operational commands
  if (canonical.startsWith('show running')) {
    const completedForDev = steps.filter(s => s.device === currentDevice.toUpperCase() && s.completed);
    outputLines.push('Building configuration...');
    outputLines.push('Current configuration : 1482 bytes');
    outputLines.push('!');
    outputLines.push(`hostname ${currentDevice}`);
    outputLines.push('!');
    if (completedForDev.length > 0) {
      for (const s of completedForDev) {
        outputLines.push(` ${s.rawCommand}`);
      }
    } else {
      outputLines.push(' ! (まだ設定コマンドが投入されていません)');
    }
    outputLines.push('!');
    outputLines.push('end');
  } else if (canonical.startsWith('show ip interface') || canonical.startsWith('show ip int')) {
    if (question.commandOutputs) {
      outputLines.push(question.commandOutputs);
    } else {
      outputLines.push('Interface              IP-Address      OK? Method Status                Protocol');
      outputLines.push('Ethernet0/0            10.0.12.1       YES manual up                    up');
      outputLines.push('Ethernet0/1            10.0.13.1       YES manual up                    up');
      outputLines.push('Ethernet0/2            192.168.1.1     YES manual up                    up');
    }
  } else if (canonical.startsWith('show vlan')) {
    outputLines.push('VLAN Name                             Status    Ports');
    outputLines.push('---- -------------------------------- --------- -------------------------------');
    outputLines.push('1    default                          active    Et0/0, Et0/1, Et0/2, Et0/3');
    for (const s of steps.filter(st => st.device === currentDevice.toUpperCase() && st.completed)) {
      if (s.canonicalCommand.startsWith('vlan ')) {
        outputLines.push(`${s.canonicalCommand.replace('vlan ', '').padEnd(4)} configured_vlan                  active`);
      }
    }
  } else if (canonical.startsWith('show ip route')) {
    outputLines.push('Codes: L - local, C - connected, S - static, O - OSPF, B - BGP');
    for (const s of steps.filter(st => st.device === currentDevice.toUpperCase() && st.completed)) {
      if (s.canonicalCommand.startsWith('ip route ')) {
        outputLines.push(`S    ${s.rawCommand.replace(/^ip route\s+/i, '')}`);
      }
    }
  } else if (canonical === 'copy running-config startup-config') {
    outputLines.push('Destination filename [startup-config]? ');
    outputLines.push('Building configuration...');
    outputLines.push('[OK]');
  } else if (canonical.startsWith('clear ip ospf process')) {
    outputLines.push('Reset ALL OSPF processes? [no]: y');
    outputLines.push('*Oct 26 12:00:01.215: %OSPF-5-ADJCHG: Process 1, OSPF process reset');
  } else if (canonical.startsWith('ping ')) {
    outputLines.push('Type escape sequence to abort.');
    outputLines.push('Sending 5, 100-byte ICMP Echos, timeout is 2 seconds:');
    outputLines.push('!!!!!');
    outputLines.push('Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms');
  }

  // Check if command satisfies any uncompleted step for this device (or any device if only 1 step matches)
  let matchedStep: RequiredCliStep | undefined;
  const upperDev = currentDevice.toUpperCase();

  const updatedSteps = steps.map(step => {
    if (step.completed || matchedStep) return step;
    if (step.device === upperDev && step.canonicalCommand === canonical) {
      matchedStep = { ...step, completed: true };
      return matchedStep;
    }
    return step;
  });

  // Fallback: if user didn't switch device tab yet, but typed a command that uniquely matches an uncompleted step on another device, allow matching if it's not an ambiguous `interface` command
  if (!matchedStep && !canonical.startsWith('interface ')) {
    for (let i = 0; i < updatedSteps.length; i++) {
      const step = updatedSteps[i];
      if (!step.completed && step.canonicalCommand === canonical) {
        matchedStep = { ...step, completed: true };
        updatedSteps[i] = matchedStep;
        break;
      }
    }
  }

  return {
    nextMode,
    outputLines,
    updatedSteps,
    matchedStep,
  };
}
