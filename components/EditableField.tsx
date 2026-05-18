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
    <div className="flex flex-col gap-2 w-full group">
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1 transition-colors group-focus-within:text-primary">
        {label}
      </label>
      <Input 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className="w-full text-sm bg-slate-50/50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 transition-all focus:ring-4 focus:ring-primary/5 focus:border-primary/50 px-4 py-2.5 h-11 rounded-2xl"
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
    <div className="flex flex-col gap-4 p-6 bg-slate-50/30 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-3xl transition-all focus-within:border-primary/20">
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
        {label}
      </label>
      <div className="flex flex-wrap gap-2.5 min-h-[2.5rem]">
        {tags.map((tag, idx) => (
          <Badge key={idx} variant="secondary" className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:bg-white/80 group">
            {tag}
            <X 
              className="w-3.5 h-3.5 cursor-pointer text-slate-300 hover:text-red-500 transition-colors" 
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
            className="h-10 text-xs bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-primary/5"
            placeholder="Add new tag..."
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
          />
        </div>
        <Button 
          variant="outline"
          size="sm"
          onClick={addTag}
          className="h-10 px-5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 border-transparent rounded-xl"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}
