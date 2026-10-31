import { Bell, Link, Sliders, Store, ShoppingCart } from 'lucide-react';

export type SettingsSection = 'general' | 'checkout' | 'precision' | 'webhooks' | 'notifications';
export const settingsSections = [
  { key: 'general', path: 'profile', icon: Store, emoji: '🏪', en: 'Merchant Profile', ar: 'ملف التاجر', descriptionEn: 'Manage your business identity and profile photo across NilePay.', descriptionAr: 'إدارة هوية نشاطك وصورة الملف الشخصي على نايل باي.' },
  { key: 'checkout', path: 'checkout', icon: ShoppingCart, emoji: '🛒', en: 'Checkout', ar: 'إعدادات الدفع', descriptionEn: 'Set your payment link and the time customers have to complete a checkout.', descriptionAr: 'ضبط رابط الدفع والمهلة المتاحة للعملاء لإتمام جلسة الدفع.' },
  { key: 'precision', path: 'precision', icon: Sliders, emoji: '⚙️', en: 'Payment Rules', ar: 'قواعد المدفوعات', descriptionEn: 'Choose how overpaid and underpaid payments are handled.', descriptionAr: 'ضبط قواعد التعامل مع الدفعات الزائدة والناقصة.' },
  { key: 'webhooks', path: 'webhooks', icon: Link, emoji: '🔗', en: 'Integrations', ar: 'التكاملات', descriptionEn: 'Configure webhook delivery and review your integration settings.', descriptionAr: 'ضبط الويب هوك ومراجعة إعدادات التكامل.' },
  { key: 'notifications', path: 'notifications', icon: Bell, emoji: '🔔', en: 'Notifications', ar: 'التنبيهات', descriptionEn: 'Read and manage messages and operational alerts.', descriptionAr: 'قراءة وإدارة الرسائل والتنبيهات التشغيلية.' },
] as const;

export function parseSettingsSection(sub?: string): SettingsSection {
  const value = sub?.toLowerCase() || '';
  if (value.includes('notification')) return 'notifications';
  if (value.includes('precision') || value.includes('tolerance')) return 'precision';
  if (value.includes('webhook') || value.includes('integration')) return 'webhooks';
  if (value.includes('checkout')) return 'checkout';
  return 'general';
}
