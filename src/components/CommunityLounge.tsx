import React, { useState } from 'react';
import { 
  MessageSquare, 
  ThumbsUp, 
  ShieldAlert, 
  ShieldCheck, 
  HelpCircle, 
  Send, 
  PlusCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { INITIAL_POSTS } from '../data/community';
import type { CommunityPost, PostCategory } from '../types';

export const CommunityLounge: React.FC = () => {
  const [posts, setPosts] = useState<CommunityPost[]>(INITIAL_POSTS);
  const [activeTab, setActiveTab] = useState<'all' | PostCategory>('all');
  const [upvotedPostIds, setUpvotedPostIds] = useState<Record<string, boolean>>({});

  // 展开回复的帖子
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // 发帖 Modal
  const [showPostModal, setShowPostModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newCategory, setNewCategory] = useState<PostCategory>('avoid_trap');
  const [newRole, setNewRole] = useState('在职打工人');
  const [newContent, setNewContent] = useState('');
  const [newBadge, setNewBadge] = useState('');

  const handleUpvote = (postId: string) => {
    if (upvotedPostIds[postId]) return;
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, upvotes: p.upvotes + 1 } : p))
    );
    setUpvotedPostIds((prev) => ({ ...prev, [postId]: true }));
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
  };

  const handleAddReply = (postId: string) => {
    if (!replyText.trim()) return;
    const newReply = {
      id: `rep-${Date.now()}`,
      author: '匿名热心打工人',
      content: replyText.trim(),
      createdAt: '刚刚'
    };
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              repliesCount: p.repliesCount + 1,
              replies: [...(p.replies || []), newReply]
            }
          : p
      )
    );
    setReplyText('');
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const newPostItem: CommunityPost = {
      id: `post-${Date.now()}`,
      authorAlias: `匿名打工人 #${Math.floor(1000 + Math.random() * 9000)}`,
      authorRole: newRole,
      targetBrandName: newTarget || '行业交流',
      category: newCategory,
      title: newTitle.trim(),
      content: newContent.trim(),
      evidenceBadge: newBadge.trim() || undefined,
      upvotes: 1,
      repliesCount: 0,
      createdAt: '刚刚',
      replies: []
    };

    setPosts([newPostItem, ...posts]);
    setShowPostModal(false);
    setNewTitle('');
    setNewTarget('');
    setNewContent('');
    setNewBadge('');
    confetti({ particleCount: 80, spread: 80 });
  };

  const filteredPosts = posts.filter((p) => {
    if (activeTab === 'all') return true;
    return p.category === activeTab;
  });

  return (
    <div className="space-y-8">
      {/* 头部社区横幅 */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="max-w-2xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            打工人茶水间 · 真实互助讨论广场
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            这里没有公关控评：
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              员工敢讲真工时，买家抱团选平替
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            打破企业信息黑盒。每一条爆料与安利均由匿名在职者、离职员工与清醒消费者提供。
            欢迎吐槽单休企业、为良心双休品牌种草，或发起企业作息求扒悬赏。
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            {[
              { id: 'all', label: '全部交流' },
              { id: 'avoid_trap', label: '避雷曝光墙', icon: ShieldAlert },
              { id: 'recommend_wlb', label: '良心种草区', icon: ShieldCheck },
              { id: 'ask_intel', label: '求扒悬赏区', icon: HelpCircle }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowPostModal(true)}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>匿名发帖交流</span>
          </button>
        </div>
      </div>

      {/* 帖子瀑布流 */}
      <div className="space-y-4">
        {filteredPosts.map((post) => (
          <div
            key={post.id}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs hover:shadow-md transition space-y-4"
          >
            {/* 头部作者信息 */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center shadow-xs">
                  {post.authorAlias.slice(-2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">{post.authorAlias}</span>
                    {post.authorRole && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium border border-slate-200">
                        {post.authorRole}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{post.createdAt}</div>
                </div>
              </div>

              {/* 标签 */}
              <div className="flex items-center gap-1.5">
                {post.evidenceBadge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300 font-medium">
                    ★ {post.evidenceBadge}
                  </span>
                )}
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    post.category === 'avoid_trap'
                      ? 'bg-rose-100 text-rose-800'
                      : post.category === 'recommend_wlb'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {post.category === 'avoid_trap'
                    ? '避雷曝光'
                    : post.category === 'recommend_wlb'
                    ? '良心平替'
                    : '企业求扒'}
                </span>
              </div>
            </div>

            {/* 帖子正文 */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-bold font-mono">
                  @{post.targetBrandName}
                </span>
                <h3 className="font-black text-slate-900 text-sm sm:text-base leading-snug">
                  {post.title}
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">{post.content}</p>
            </div>

            {/* 互动动作区 */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleUpvote(post.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition ${
                    upvotedPostIds[post.id]
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>{post.upvotes} 认同</span>
                </button>

                <button
                  onClick={() =>
                    setExpandedPostId(expandedPostId === post.id ? null : post.id)
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{post.repliesCount} 条交流</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-400">零知识隐私公证已生效</div>
            </div>

            {/* 回复折叠楼层 */}
            {expandedPostId === post.id && (
              <div className="pt-3 mt-3 border-t border-slate-100 space-y-3 bg-slate-50/60 p-4 rounded-2xl">
                <div className="text-xs font-bold text-slate-800">
                  讨论交流 ({post.replies?.length || 0})
                </div>

                <div className="space-y-2">
                  {post.replies?.map((rep) => (
                    <div
                      key={rep.id}
                      className="bg-white p-3 rounded-xl border border-slate-200/80 text-xs space-y-1"
                    >
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span className="font-bold text-slate-700">{rep.author}</span>
                        <span className="font-mono">{rep.createdAt}</span>
                      </div>
                      <p className="text-slate-700 leading-normal">{rep.content}</p>
                    </div>
                  ))}
                  {(!post.replies || post.replies.length === 0) && (
                    <div className="text-[11px] text-slate-400 py-2">暂无回复，快来抢首评！</div>
                  )}
                </div>

                {/* 快速回复框 */}
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="匿名理性留言交流，共同打破信息差..."
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddReply(post.id)}
                  />
                  <button
                    onClick={() => handleAddReply(post.id)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm"
                  >
                    <Send className="w-3 h-3" />
                    <span>发言</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 发帖弹窗 Modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto text-slate-900">
            <div className="bg-slate-900 text-white p-6 relative">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    发起匿名讨论 / 爆料 / 种草
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    全过程不记录 IP，支持提供客观事实案号与打卡体验。
                  </p>
                </div>
                <button
                  onClick={() => setShowPostModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleCreatePost} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">讨论主题类型:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'avoid_trap', label: '避雷单休曝光' },
                    { id: 'recommend_wlb', label: '良心双休平替' },
                    { id: 'ask_intel', label: '求扒企业工时' }
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setNewCategory(t.id as any)}
                      className={`p-2.5 rounded-xl border text-center font-bold transition ${
                        newCategory === t.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">针对品牌/企业:</label>
                  <input
                    type="text"
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    placeholder="如：某汽车厂 / 某咖啡连锁"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">你的身份标签:</label>
                  <input
                    type="text"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder="如：在职技术 / 离职员工 / 消费者"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">帖子标题:</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="简洁有力的标题，吸引更多打工人关注..."
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">客观陈述内容:</label>
                <textarea
                  rows={4}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="客观写明部门、作息、下班时间、加班费是否发放，或为什么推荐/避雷该品牌..."
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  佐证凭据标签 (可选):
                </label>
                <input
                  type="text"
                  value={newBadge}
                  onChange={(e) => setNewBadge(e.target.value)}
                  placeholder="如：劳动裁判文书网案号 / 工牌脱敏 / 官方通报链接"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-md shadow-slate-900/20"
                >
                  发布交流
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
