'use client';

import { useState } from 'react';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { X, Plus } from 'lucide-react';

export function EditableTextField({ 
  value, 
  onChange, 
  label 
}: { 
  value: string; 
  onChange: (val: string) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-3 w-full group">
      <div className="flex items-center gap-2 ml-1">
        <div className="w-1 h-3 bg-primary/20 rounded-full transition-colors group-focus-within:bg-primary" />
        <label className="text-[11px] font-black tracking-widest text-slate-500/80 transition-colors group-focus-within:text-primary leading-none">
          {label}
        </label>
      </div>
      <Input 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className="w-full text-sm bg-slate-50/30 dark:bg-slate-950 border-slate-100 dark:border-slate-800 transition-all focus:ring-[6px] focus:ring-primary/5 focus:border-primary/40 px-5 py-3 h-12 rounded-[20px] shadow-sm"
      />
    </div>
  );
}

export function EditableTagList({
  tags,
  onChange,
  label
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  label: string;
}) {
  const [newTag, setNewTag] = useState('');

  const removeTag = (idx: number) => {
    onChange(tags.filter((_, i) => i !== idx));
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      onChange([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  return (
    <div className="flex flex-col gap-5 p-6 bg-slate-50/[0.1] dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-[28px] transition-all focus-within:border-primary/20">
      <div className="flex items-center gap-2 ml-1">
        <div className="w-1 h-3 bg-primary/20 rounded-full" />
        <label className="text-[11px] font-black tracking-widest text-slate-500/80 leading-none">
          {label}
        </label>
      </div>
      <div className="flex flex-wrap gap-2 min-h-[2rem]">
        {tags.map((tag, idx) => (
          <Badge key={idx} variant="secondary" className="flex items-center gap-2 px-2.5 py-1 text-[10px] font-bold tracking-wide bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:bg-white/80 shadow-sm transition-all group">
            {tag}
            <X 
              className="w-3 h-3 cursor-pointer text-slate-300 hover:text-red-500 transition-colors" 
              onClick={() => removeTag(idx)} 
            />
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input 
            value={newTag} 
            onChange={(e) => setNewTag(e.target.value)} 
            className="h-10 text-[11px] font-medium bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 rounded-[14px] focus:ring-[4px] focus:ring-primary/5 px-4"
            placeholder="Add new..."
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
          />
        </div>
        <Button 
          variant="outline"
          size="sm"
          onClick={addTag}
          className="h-10 px-4 text-[10px] font-black bg-primary text-primary-foreground hover:bg-primary/90 border-transparent rounded-[14px] shadow-md shadow-primary/10"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
        </Button>
      </div>
    </div>
  );
}
