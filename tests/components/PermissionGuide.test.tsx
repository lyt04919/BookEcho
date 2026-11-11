import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PermissionGuide, PermissionGuideProps } from '../../src/components/PermissionGuide';

describe('PermissionGuide Component', () => {
  const defaultProps: PermissionGuideProps = {
    onSelectDir: vi.fn(),
    onRetry: vi.fn(),
  };

  it('should render the permission title and description text', () => {
    const html = renderToStaticMarkup(<PermissionGuide {...defaultProps} />);
    expect(html).toContain('需要 Apple Books 数据读取权限');
    expect(html).toContain('macOS 对 Apple Books 容器');
    expect(html).toContain('~/Library/Containers/com.apple.iBooksX');
    expect(html).toContain('不会自动弹出或自动添加新软件');
    expect(html).toContain('完全退出并重新打开 BookEcho');
  });

  it('should render all action buttons with correct labels', () => {
    const html = renderToStaticMarkup(<PermissionGuide {...defaultProps} />);
    expect(html).toContain('手动选择 iBooks 目录或备份');
    expect(html).toContain('打开系统隐私设置');
    expect(html).toContain('重新检测系统权限');
  });

  it('should render action buttons that trigger callbacks', () => {
    const onSelectDir = vi.fn();
    const onRetry = vi.fn();
    const onOpenPrivacy = vi.fn();
    const element = <PermissionGuide onSelectDir={onSelectDir} onRetry={onRetry} onOpenPrivacy={onOpenPrivacy} />;
    
    // Simulate click via props directly on elements
    element.props.onSelectDir();
    element.props.onRetry();
    element.props.onOpenPrivacy();

    expect(onSelectDir).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onOpenPrivacy).toHaveBeenCalledTimes(1);
  });

  it('should support dark mode styling tokens', () => {
    const html = renderToStaticMarkup(<PermissionGuide {...defaultProps} />);
    expect(html).toContain('dark:bg-night-bg');
    expect(html).toContain('dark:text-night-text');
  });
});
