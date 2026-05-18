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
    <div className="flex flex-col gap-1.5 w-full group">
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1.5 transition-colors group-focus-within:text-primary">
        {label}
      </label>
      <Input 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className="w-full text-sm bg-background border-slate-200 transition-all focus:ring-1 focus:ring-primary/20 focus:border-primary px-3 py-2 h-9 rounded-md"
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
    <div className="flex flex-col gap-3 p-4 bg-slate-50/50 border border-slate-200 rounded-lg transition-all focus-within:border-primary/30">
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-0.5">
        {label}
      </label>
      <div className="flex flex-wrap gap-2 min-h-[2rem]">
        {tags.map((tag, idx) => (
          <Badge key={idx} variant="secondary" className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-white border-slate-200 hover:bg-slate-50 group">
            {tag}
            <X 
              className="w-3 h-3 cursor-pointer text-muted-foreground hover:text-destructive transition-colors" 
              onClick={() => removeTag(idx)} 
            />
          </Badge>
        ))}
      </div>
      <div className="flex gap-2 mt-1">
        <div className="relative flex-1">
          <Input 
            value={newTag} 
            onChange={(e) => setNewTag(e.target.value)} 
            className="h-8 text-xs bg-white border-slate-200 focus:ring-1 focus:ring-primary/10"
            placeholder="输入并回车..."
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
          />
        </div>
        <Button 
          variant="outline"
          size="sm"
          onClick={addTag}
          className="h-8 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-transparent"
        >
          <Plus className="w-3 h-3 mr-1" /> 添加
        </Button>
      </div>
    </div>
  );
}
