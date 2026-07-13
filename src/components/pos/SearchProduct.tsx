import { Search } from "lucide-react";
import { InputGroup, InputGroupButton, InputGroupInput } from "@/ui/input-group";

const SearchProduct = ({ searchValue, setSearchQuery, className, props }: {
  searchValue: string;
  setSearchQuery: (value: string) => void;
  className?: string;
  props?: any
}) => {
  return (
    <InputGroup>
      <InputGroupButton>
        <Search />
      </InputGroupButton>
      <InputGroupInput
        type="text"
        className={`pr-3 [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden [&::-webkit-textfield-decoration-container]:hidden ${className}`}
        value={searchValue}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Cari nama atau barcode produk"
        {...props}
      />
    </InputGroup>
  );
};

export default SearchProduct;
