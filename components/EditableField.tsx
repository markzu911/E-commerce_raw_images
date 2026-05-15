'use client';

import { useState } from 'react';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
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
    <div className="flex flex-col gap-1 w-full relative">
      <span className="text-xs text-muted-foreground absolute -top-2 left-2 bg-background px-1">{label}</span>
      <Input 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className="w-full text-sm"
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
    <div className="flex flex-col gap-2 p-3 border rounded-md relative pt-4">
      <span className="text-xs text-muted-foreground absolute -top-2 left-2 bg-background px-1">{label}</span>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, idx) => (
          <Badge key={idx} variant="secondary" className="flex items-center gap-1 group">
            {tag}
            <X 
              className="w-3 h-3 cursor-pointer opacity-50 group-hover:opacity-100" 
              onClick={() => removeTag(idx)} 
            />
          </Badge>
        ))}
      </div>
      <div className="flex gap-2 mt-1">
        <Input 
          value={newTag} 
          onChange={(e) => setNewTag(e.target.value)} 
          className="h-7 text-xs flex-1"
          placeholder="添加..."
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
        />
        <button 
          onClick={addTag}
          className="h-7 px-2 bg-primary text-primary-foreground rounded text-xs flex items-center"
        >
          <Plus className="w-3 h-3 mr-1" /> 添加
        </button>
      </div>
    </div>
  );
}
