import questionsFixedData from './questions_fixed.json';
import manifestData from './database_manifest.json';
import { QuestionItem } from '../types/question';

// Directly load verified CCNA question dataset (641 questions)
export const ALL_QUESTIONS: QuestionItem[] = (questionsFixedData as unknown) as QuestionItem[];
export const DATABASE_MANIFEST = manifestData;

// Category mapping and counts
export interface CategoryInfo {
  id: string;
  name: string;
  count: number;
  description: string;
  iconName: string;
}

export const CATEGORIES: CategoryInfo[] = [
  {
    id: 'Network Fundamentals',
    name: 'ネットワーク基礎 (Network Fundamentals)',
    count: ALL_QUESTIONS.filter(q => q.category === 'Network Fundamentals').length,
    description: 'OSI参照モデル、TCP/UDP、IPv4/IPv6、ケーブリング、スイッチング基礎',
    iconName: 'Network'
  },
  {
    id: 'Network Access',
    name: 'ネットワークアクセス (Network Access)',
    count: ALL_QUESTIONS.filter(q => q.category === 'Network Access').length,
    description: 'VLAN、トランキング(802.1Q)、STP/RSTP、EtherChannel、無線LAN(WLAN/WLC)',
    iconName: 'Server'
  },
  {
    id: 'IP Connectivity',
    name: 'IP接続性 (IP Connectivity)',
    count: ALL_QUESTIONS.filter(q => q.category === 'IP Connectivity').length,
    description: 'ルーティングテーブル、スタティックルート、OSPFv2、浮動スタティックルート',
    iconName: 'Route'
  },
  {
    id: 'IP Services',
    name: 'IPサービス (IP Services)',
    count: ALL_QUESTIONS.filter(q => q.category === 'IP Services').length,
    description: 'NAT/PAT、DHCP、DNS、SNMP、NTP、Syslog、FHRP (HSRP/VRRP)',
    iconName: 'Cpu'
  },
  {
    id: 'Security Fundamentals',
    name: 'セキュリティ基礎 (Security Fundamentals)',
    count: ALL_QUESTIONS.filter(q => q.category === 'Security Fundamentals').length,
    description: 'ACL (標準/拡張)、ポートセキュリティ、DHCPスヌーピング、DAI、VPN、AAA',
    iconName: 'ShieldCheck'
  },
  {
    id: 'Automation and Programmability',
    name: '自動化とプログラマビリティ (Automation)',
    count: ALL_QUESTIONS.filter(q => q.category === 'Automation and Programmability' || q.category.includes('Automation')).length,
    description: 'REST API、JSON/XML/YAML、Cisco DNA Center、Ansible/Puppet/Chef、SDN',
    iconName: 'Bot'
  },
  {
    id: 'Simulation',
    name: 'シミュレーション演習 (Simulation / CLI)',
    count: ALL_QUESTIONS.filter(q => q.type === 'simulation' || q.part.toLowerCase().includes('sim')).length,
    description: '実機Cisco IOSコマンド設定・トポロジ検証・showコマンド解析の実践問題',
    iconName: 'Terminal'
  }
];

export const PART_LIST = [
  { id: 'part11', name: 'Part 11', count: ALL_QUESTIONS.filter(q => q.part.toLowerCase() === 'part11').length, source: 'part11_c265ac26.pdf' },
  { id: 'part12', name: 'Part 12', count: ALL_QUESTIONS.filter(q => q.part.toLowerCase() === 'part12').length, source: 'part12_115faeb5.pdf' },
  { id: 'part13', name: 'Part 13', count: ALL_QUESTIONS.filter(q => q.part.toLowerCase() === 'part13').length, source: 'part13_e8406ce6.pdf' },
  { id: 'part14', name: 'Part 14', count: ALL_QUESTIONS.filter(q => q.part.toLowerCase() === 'part14').length, source: 'part14_3e9b8432.pdf' },
  { id: 'part15', name: 'Part 15', count: ALL_QUESTIONS.filter(q => q.part.toLowerCase() === 'part15').length, source: 'part15_8bd6d2d6.pdf' },
  { id: 'part16', name: 'Part 16', count: ALL_QUESTIONS.filter(q => q.part.toLowerCase() === 'part16').length, source: 'part16_ada55c2a.pdf' },
  { id: 'simulation', name: 'シミュレーション演習', count: ALL_QUESTIONS.filter(q => q.part.toLowerCase().includes('sim') || q.type === 'simulation').length, source: 'シミュレーション問題.pdf / シミュレーション問題2.pdf' },
];

export function getQuestionById(id: string): QuestionItem | undefined {
  return ALL_QUESTIONS.find(q => q.id === id);
}
