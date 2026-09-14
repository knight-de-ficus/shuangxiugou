import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  Sparkles, 
  ChevronRight, 
  Filter, 
  CheckCircle2, 
  Tag 
} from 'lucide-react';
import { CATEGORY_PAIRS } from '../data/community';
import type { BrandItem } from '../types';

interface ShoppingLensProps {
  brands: BrandItem[];
  onSelectBrand: (brand: BrandItem) => void;
  onOpenTicket: (brand: BrandItem) => void;
}

export const ShoppingLens: React.FC<ShoppingLensProps> = ({
  brands,
  onSelectBrand,
  onOpenTicket,
}) => {
  const [lensSearch, setLensSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部品类');

  const categories = ['全部品类', '汽车配件', '数码外设', '食品饮品', '服装饰品', '整车出行'];

  const filteredPairs = useMemo(() => {
    return CATEGORY_PAIRS.filter((pair) => {
      const matchText =
        pair.categoryName.toLowerCase().includes(lensSearch.toLowerCase()) ||
        pair.searchKeywords.some((k: string) => k.toLowerCase().includes(lensSearch.toLowerCase())) ||
        pair.boycottBrand.name.toLowerCase().includes(lensSearch.toLowerCase()) ||
        pair.recommendedAlternatives.some((a: { name: string }) =>
          a.name.toLowerCase().includes(lensSearch.toLowerCase())
        );

      if (!matchText) return false;

      if (activeCategory === '全部品类') return true;
      return pair.categoryName.includes(activeCategory);
    });
  }, [lensSearch, activeCategory]);

  return (
    <div className="space-y-8">
      {/* 头部宣传条 */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-2xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30">
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
            网购透镜 · 查避雷选良心平替
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            买东西前查一眼：
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              左边避开血汗单休，右边一键选双休平替
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            不用再费劲搜索工商母公司。直接输入你想买的商品关键词（如“车灯”、“咖啡”、“冲锋衣”、“鼠标”），
            透镜系统立即为你呈现真实劳工红黑对比，把每一笔订单留给体恤打工人的守法品牌。
          </p>
        </div>

        {/* 快捷搜索栏 */}
        <div className="mt-6 pt-6 border-t border-slate-700/80 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={lensSearch}
              onChange={(e) => setLensSearch(e.target.value)}
              placeholder="搜索商品或品类：如 车灯 / 鼠标 / 咖啡豆 / 冲锋衣 / 比亚迪..."
              className="w-full bg-slate-950/70 border border-slate-600 rounded-2xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {['车灯', '鼠标', '咖啡', '冲锋衣', '电车'].map((tag) => (
              <button
                key={tag}
                onClick={() => setLensSearch(tag)}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-emerald-300 transition whitespace-nowrap"
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 品类过滤 Tab */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-semibold">
        <span className="text-slate-400 flex items-center gap-1 pl-1">
          <Filter className="w-3.5 h-3.5" /> 快速品类:
        </span>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full transition whitespace-nowrap ${
              activeCategory === cat
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 红黑对照卡片列表 */}
      <div className="space-y-6">
        {filteredPairs.map((pair) => (
          <div
            key={pair.id}
            className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
          >
            {/* 品类标题栏 */}
            <div className="bg-slate-50/80 px-6 py-3.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span className="tracking-wide text-slate-900">{pair.categoryName}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400 text-[11px] font-normal">
                <span>匹配关键词: {pair.searchKeywords.slice(0, 3).join(', ')}</span>
              </div>
            </div>

            {/* 红黑并排对比栅格 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* 左侧：避雷区 (4列) */}
              <div className="lg:col-span-4 p-6 bg-rose-50/30 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100/80 text-rose-800 text-xs font-black border border-rose-300">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    【建议避雷】单休/违约高危
                  </div>

                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">
                      {pair.boycottBrand.name}
                    </h3>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      涉及商品：{pair.boycottBrand.keyProduct}
                    </div>
                  </div>

                  <p className="text-xs text-rose-900/90 leading-relaxed bg-white/80 p-3 rounded-xl border border-rose-200 font-sans">
                    {pair.boycottBrand.reason}
                  </p>
                </div>

                <div className="pt-2 text-[11px] text-slate-400 flex items-center gap-1">
                  <span>买前扣下钱包，让压榨企业失去订单</span>
                </div>
              </div>

              {/* 右侧：推荐良心平替 (8列) */}
              <div className="lg:col-span-8 p-6 bg-emerald-50/20 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-black border border-emerald-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    【良心推荐】落实双休守护者
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {pair.recommendedAlternatives.map((alt) => {
                      const matchedBrand = brands.find((b) => b.id === alt.id);
                      return (
                        <div
                          key={alt.id}
                          className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-xs hover:border-emerald-400 hover:shadow-sm transition flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-black text-slate-900 text-sm">
                                {alt.name}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-300 font-mono">
                                {alt.tier}级标杆
                              </span>
                            </div>

                            <div className="text-xs font-bold text-emerald-700">
                              {alt.policyLabel}
                            </div>

                            <div className="text-[11px] text-slate-500">
                              主推良品：<strong className="text-slate-800">{alt.keyProduct}</strong>
                            </div>

                            <p className="text-[11px] text-slate-600 leading-relaxed pt-1">
                              {alt.highlight}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                            {matchedBrand && (
                              <button
                                onClick={() => onOpenTicket(matchedBrand)}
                                className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition text-[11px]"
                              >
                                <Sparkles className="w-3 h-3 text-emerald-600" />
                                <span>打卡支持</span>
                              </button>
                            )}

                            {matchedBrand && (
                              <button
                                onClick={() => onSelectBrand(matchedBrand)}
                                className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-0.5 text-[11px]"
                              >
                                <span>查验证据</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 text-xs text-slate-500 flex items-center justify-between">
                  <span>把每一分钱投给尊重员工身心健康的良心企业</span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 均已通过社区与官方交叉核验
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredPairs.length === 0 && (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300 space-y-3">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-slate-700 font-bold text-sm">
              暂时没有找到关于 "{lensSearch}" 的品类平替记录
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              欢迎在打工人茶水间或 GitHub 发起悬赏，我们将安排调查员查证并上架该品类！
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
