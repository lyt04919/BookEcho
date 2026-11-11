import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SettingsModal, SettingsModalProps } from '../../src/components/SettingsModal';
import { DEFAULT_COLOR_SEMANTICS } from '../../src/components/ColorSemanticsModal';

describe('SettingsModal Component', () => {
  const defaultProps: SettingsModalProps = {
    isOpen: true,
    onClose: vi.fn(),
    initialTab: 'general',
    isDarkMode: false,
    onToggleDarkMode: vi.fn(),
    colorSemantics: DEFAULT_COLOR_SEMANTICS,
    onSaveColorSemantics: vi.fn(),
    customDataDir: null,
    onSelectCustomDir: vi.fn(),
    onResetCustomDir: vi.fn(),
    isDemoMode: false,
    onToggleDemoMode: vi.fn(),
    exportFormat: 'obsidian',
    onUpdateExportFormat: vi.fn()
  };

  it('should not render anything when isOpen is false', () => {
    const html = renderToStaticMarkup(<SettingsModal {...defaultProps} isOpen={false} />);
    expect(html).toBe('');
  });

  it('should render modal dialog with tabs when isOpen is true', () => {
    const html = renderToStaticMarkup(<SettingsModal {...defaultProps} />);
    expect(html).toContain('data-testid="settings-modal"');
    expect(html).toContain('偏好设置');
    expect(html).toContain('外观与偏好');
    expect(html).toContain('高亮色彩语义');
    expect(html).toContain('数据源与同步');
    expect(html).toContain('Markdown 导出');
    expect(html).toContain('关于 BookEcho');
  });

  it('should render general tab content when initialTab is general', () => {
    const html = renderToStaticMarkup(<SettingsModal {...defaultProps} initialTab="general" />);
    expect(html).toContain('界面主题外观');
    expect(html).toContain('浅色羊皮纸');
    expect(html).toContain('深色夜读');
    expect(html).toContain('快捷键指引');
    expect(html).toContain('⌘ ,');
  });

  it('should render highlights tab content when initialTab is highlights', () => {
    const html = renderToStaticMarkup(<SettingsModal {...defaultProps} initialTab="highlights" />);
    expect(html).toContain('经典精读流');
    expect(html).toContain('卡片盒写作流');
    expect(html).toContain('外语精学流');
    expect(html).toContain('黄色高亮');
    expect(html).toContain('核心论点');
    expect(html).toContain('应用色彩设置');
    expect(html).toContain('恢复默认预设');
  });

  it('should render storage tab content with default system directory', () => {
    const html = renderToStaticMarkup(<SettingsModal {...defaultProps} initialTab="storage" />);
    expect(html).toContain('Apple Books 数据源目录');
    expect(html).toContain('系统原生默认');
    expect(html).toContain('更换数据源目录');
    expect(html).toContain('体验测试数据 (Demo Mode)');
  });

  it('should render storage tab content with custom directory and reset button', () => {
    const html = renderToStaticMarkup(
      <SettingsModal {...defaultProps} initialTab="storage" customDataDir="/Volumes/Backup/AppleBooks" />
    );
    expect(html).toContain('/Volumes/Backup/AppleBooks');
    expect(html).toContain('自定义备份');
    expect(html).toContain('恢复系统默认路径');
  });

  it('should render export tab with Obsidian and standard options', () => {
    const html = renderToStaticMarkup(<SettingsModal {...defaultProps} initialTab="export" />);
    expect(html).toContain('Markdown 导出格式偏好');
    expect(html).toContain('Obsidian 增强格式（推荐）');
    expect(html).toContain('标准 Markdown 引用格式');
  });

  it('should render about tab with app version and local-first assurance', () => {
    const html = renderToStaticMarkup(<SettingsModal {...defaultProps} initialTab="about" />);
    expect(html).toContain('BookEcho');
    expect(html).toContain('v1.0.0');
    expect(html).toContain('本地优先与隐私安全（Local-first）');
    expect(html).toContain('GitHub 仓库');
  });
});
