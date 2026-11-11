import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  subLabel?: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  dropdownWidthClass?: string;
  ariaLabel?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '请选择',
  icon,
  searchable = true,
  searchPlaceholder = '搜索选项...',
  className = '',
  dropdownWidthClass = 'w-64 min-w-[200px]',
  ariaLabel
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // 点击外部关闭弹层
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
      // 展开时自动聚焦搜索输入框
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  // 过滤后的选项
  const filteredOptions = options.filter(opt => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const labelMatch = opt.label.toLowerCase().includes(q);
    const subMatch = (opt.subLabel || '').toLowerCase().includes(q);
    return labelMatch || subMatch;
  });

  return (
    <div ref={containerRef} className="relative inline-block text-xs">
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev);
          setSearchQuery('');
        }}
        aria-label={ariaLabel || selectedOption?.label || placeholder}
        aria-expanded={isOpen}
        className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text transition-all select-none shadow-2xs ${
          isOpen
            ? 'border-paper-terracotta dark:border-night-terracotta ring-1 ring-paper-terracotta/40 dark:ring-night-terracotta/40'
            : 'border-paper-border dark:border-night-border hover:border-paper-terracotta/60 dark:hover:border-night-terracotta/60'
        } ${className}`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {icon && <span className="flex-shrink-0 text-paper-muted dark:text-night-muted">{icon}</span>}
          <span className="truncate max-w-[130px] font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.count !== undefined && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted font-mono flex-shrink-0">
              {selectedOption.count}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-paper-muted dark:text-night-muted flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-paper-terracotta dark:text-night-terracotta' : ''
          }`}
        />
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div
          className={`absolute left-0 top-full mt-1.5 z-50 rounded-xl bg-paper-card/95 dark:bg-night-card/95 border border-paper-border dark:border-night-border shadow-xl backdrop-blur-md p-1.5 animate-in fade-in zoom-in-95 duration-100 ${dropdownWidthClass}`}
        >
          {/* 搜索框（当选项大于 6 个或明确启用时展示） */}
          {searchable && options.length > 6 && (
            <div className="relative mb-1.5 px-0.5">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-7 pr-2.5 py-1 rounded-lg bg-paper-drawer/80 dark:bg-night-drawer/80 border border-paper-border/60 dark:border-night-border/60 text-xs text-paper-text dark:text-night-text placeholder:text-paper-muted/70 focus:outline-none focus:ring-1 focus:ring-paper-terracotta transition-all"
                onClick={e => e.stopPropagation()}
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-paper-muted" />
            </div>
          )}

          {/* 选项滚动列表 */}
          <div className="max-h-60 overflow-y-auto space-y-0.5 overscroll-contain pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-paper-muted dark:text-night-muted">
                未找到匹配结果
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer group ${
                      isSelected
                        ? 'bg-paper-terracotta/10 text-paper-terracotta dark:text-night-terracotta font-medium'
                        : 'text-paper-text dark:text-night-text hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-terracotta dark:hover:text-night-terracotta'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.icon && (
                        <span className="flex-shrink-0 opacity-70 group-hover:opacity-100">
                          {opt.icon}
                        </span>
                      )}
                      <span className="truncate">{opt.label}</span>
                      {opt.subLabel && (
                        <span className="text-[10px] text-paper-muted dark:text-night-muted truncate opacity-80">
                          {opt.subLabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {opt.count !== undefined && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted font-mono">
                          {opt.count}
                        </span>
                      )}
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta flex-shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
