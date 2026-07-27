import { Controller, useFormContext } from 'react-hook-form';
import { TextInput } from '@/src/components/ui/TextInput';
import { TextInputProps } from 'react-native';

type Props = {
  name: string;
  label?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'decimal-pad';
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
} & TextInputProps;

export function FormInput({
  name,
  label,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline,
  ...props
}: Props) {
  const { control, formState } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error, isTouched } }) => {
        // Only surface validation errors once the field has been touched OR
        // the user has attempted to submit — avoids greeting first-time
        // users with a wall of red on Step 1 of the Prism wizard.
        const showError = isTouched || formState.isSubmitted;
        return (
          <TextInput
            label={label}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={showError ? error?.message : undefined}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            multiline={multiline}
            {...props}
          />
        );
      }}
    />
  );
}
