import { type ChangeEvent } from 'react';
import { Input } from '@/components/ui/Input';
import { AddTags, type TagOption } from '@/components/forum/AddTags';

interface TopicEditMetaFieldsProps {
  topicTitleDraft: string;
  onTopicTitleDraftChange: (value: string) => void;
  topicTagDraft: TagOption[];
  onTopicTagDraftChange: (value: TagOption[]) => void;
  editSaving: boolean;
  topicEditError: string;
}

export function TopicEditMetaFields({
  topicTitleDraft,
  onTopicTitleDraftChange,
  topicTagDraft,
  onTopicTagDraftChange,
  editSaving,
  topicEditError,
}: TopicEditMetaFieldsProps) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="topic-edit-title" className="block text-sm font-medium mb-1">
          Otsikko
        </label>
        <Input
          id="topic-edit-title"
          value={topicTitleDraft}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onTopicTitleDraftChange(e.target.value)}
          placeholder="Langan otsikko"
        />
      </div>
      <AddTags
        selected={topicTagDraft}
        onChange={onTopicTagDraftChange}
        disabled={editSaving}
        maxSelected={1}
        featuredOnly={null}
        label="Tagi"
        placeholder="Valitse tagi (tyhjä = off-topic)"
      />
      {topicEditError && <p className="text-sm text-red-600">{topicEditError}</p>}
    </div>
  );
}
