import * as React from "react";
import { useFormContext, FieldPath, FieldValues } from "react-hook-form";
import { FormFieldContext, FormItemContext } from "./form.context";

export const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }
  if (!itemContext || !itemContext.id) {
    throw new Error(
      "useFormField is used in a context where FormItemContext or its id is not available. Ensure it's within a FormItem."
    );
  }
  
  const fieldState = fieldContext.name ? getFieldState(fieldContext.name, formState) : undefined;

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...(fieldState || {}),
  };
};
