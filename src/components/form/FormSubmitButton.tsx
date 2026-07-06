import { useFormContext } from 'react-hook-form';
import { Button } from '@/src/components/ui/Button';

type Props = {
  title: string;
  onPress?: () => void;
};

export function FormSubmitButton({ title, onPress }: Props) {
  const {
    formState: { isSubmitting },
  } = useFormContext();

  return <Button title={title} loading={isSubmitting} onPress={onPress} />;
}
